const Hammer = require(`hammerjs`);
const PIXIMath = require(`@pixi/math`);
const PIXI = require(`pixi.js`);

/**
 * @description
 * a instance helper to connect hammer to pixijs instances
 * @contructor
 */
var Connector = function(appView, interactionManager, preInitedHammer, rootDisplayObject) {
	var self = this;
	var canvas = appView;

	this.config = {
		useOnlyFirstHitTest: true //only hittest on the first event then keep basing all further events off it
	}

	var handlers = {};

	self.interactionManager = interactionManager;
	self.rootDisplayObject = rootDisplayObject;

	self.updateCache(canvas);
	self._options = {};

	// hammer manager
	if(preInitedHammer){ self._mc = preInitedHammer; }
	else{ self._mc = new Hammer.Manager(canvas); }

	self.getPixiTarget = function(center){
		var newCenter = self.normalizePoint(center);
		return self.getHitDisplayObject(newCenter);
	}

	// For backwards compatability with PIXI V5 and V6.
	self.getHitDisplayObject = function(center) {
		// Only use the V7 EventSystem API if the V5 or V6 API does not exist.
		if (!self.interactionManager.hitTest) {
			console.log(`!!Using PIXI V7 EventSystem API!!`);
			const boundary = new PIXI.EventBoundary(self.rootDisplayObject);
			console.log(`Object boundary`, boundary);
			console.log(`CENTER`, center);
			var match = boundary.hitTest(center.x, center.y);
			console.log(`Display Object Hit`, match);
			return boundary.hitTest(center.x, center.y);
		}

		return self.interactionManager.hitTest(center);
	}

	self.dispatchPixiEvent = function(pixiDisplayObject, eventName, event) {
		// Use the V7 EventSystem if running V7, otherwise use old InteractionManager
		if (!self.interactionManager.dispatchEvent) {
			event.type = decorateEvent(event.type);
			const boundary = new PIXI.EventBoundary(self.rootDisplayObject);
			console.log(`EVENT DATA`, event);
			pixiDisplayObject.dispatchEvent(event);
			return;
		}

		self.interactionManager.dispatchEvent(pixiDisplayObject, eventName, event);
	}
};

/**
 * Just prefix everything hammer-y with hammer- to avoid conflicts
 * @param  {[string]} eventName
 * @return {[string]}
 */
function decorateEvent(eventName){
	return "hammer-"+eventName;
}

/**
 * @description
 * get hammer manager
 */
Connector.prototype.getManager = function() {
	var self = this;
	return self._mc;
};

/**
 * @description
 *
 */
Connector.prototype.registerHandlerTypes = function(typesArray) {
	var self = this;

	var first;
	var firstTarget;

	self._mc.on("hammer.input", function(evt){
		if(evt.isFirst){
			first = evt;
			firstTarget = self.getPixiTarget(evt.center);
			console.log(`IS FIRST`, firstTarget);
		}
	});

	typesArray.forEach(function(type){

		self._mc.on(type, function(evt){
			const pixiTarget = self.config.useOnlyFirstHitTest ? firstTarget : self.getPixiTarget(evt.center);

			if (pixiTarget){
				self.dispatchPixiEvent(pixiTarget, decorateEvent(type), evt);
			}
		});

	});
};

/**
 * @description
 * destroy connector instance
 */
Connector.prototype.destroy = function() {
	var self = this;

	for (var key in self._mc.handlers) {
		self._mc.off(key, self._mc.handlers[key]);
	}

	self._mc.destroy();
	self._mc = null;
	self._listeners = {};
};

Connector.prototype.normalizePoint = function(dstPoint) {
	var pt = new PIXIMath.Point();
	this.interactionManager.mapPositionToPoint(pt, dstPoint.x, dstPoint.y);
	return pt;
}

/**
 * @description
 * recache the canvas bound. call this when the canvas size changed
 * @param {Element?} canvas
 */
Connector.prototype.updateCache = function(canvas) {
	// offset information of this canvas
	var bound = (canvas || this._mc.element).getBoundingClientRect();
	this._offset = {
		x: bound.left,
		y: bound.top
	};
}

module.exports = Connector;
