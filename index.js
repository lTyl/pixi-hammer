const Hammer = require(`hammerjs`);
const PIXIMath = require(`@pixi/math`);
const PIXIEvents = require(`@pixi/events`);

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
	if (preInitedHammer) {
		self._mc = preInitedHammer;
	} else {
		self._mc = new Hammer.Manager(canvas);
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

Connector.prototype.getPixiTarget = function(center){
	var newCenter = this.normalizePoint(center);
	return this.getHitDisplayObject(newCenter);
}

Connector.prototype.getHitDisplayObject = function(center) {
	if (!this.isLegacyInteraction()) {
		const boundary = new PIXIEvents.EventBoundary(this.rootDisplayObject);
		return boundary.hitTest(center.x, center.y);
	}

	return this.interactionManager.hitTest(center);
}

Connector.prototype.dispatchPixiEvent = function(pixiDisplayObject, eventName, event) {
	if (!this.isLegacyInteraction()) {
		pixiDisplayObject.emit(decorateEvent(event.type), event);
		return;
	}

	this.interactionManager.dispatchEvent(pixiDisplayObject, eventName, event);
}

Connector.prototype.isLegacyInteraction = function() {
	// @pixi/events doesn't have a dispatchEvent method (that lives on the EventBoundary), so we check for that to determine capability
	return !!this.interactionManager.dispatchEvent;
}

module.exports = Connector;
