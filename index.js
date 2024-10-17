const Hammer = require(`hammerjs`);
const PIXIMath = require(`@pixi/math`);
const PIXIEvents = require(`@pixi/events`);

/**
 * Connects A PIXI JS V5, V6 or V7 App with HammerJS for gesture handling
 * @param appView {HTMLCanvasElement} The canvas element that you want gestures for
 * @param interactionManager {EventSystem|InteractionManager} A PIXI V5 or V6 InteractionManager OR a PIXI V7 EventSystem
 * @param preInitedHammer {Hammer.Manager} An instance of a pre-initialized Hammer.Manager. Leave null for a new one to be created
 * @param rootDisplayObject {DisplayObject} Required for PIXI V7. A DisplayObject that represents the root EventBoundary for interaction detection
 * @constructor
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
	return `hammer-${eventName}`;
}
/**
 * Gets the managed Hammer Manager instance
 * @returns {Hammer.Manager}
 */
Connector.prototype.getManager = function() {
	var self = this;
	return self._mc;
};
/**
 * Connects a list of HammerJS events to PIXI. When a tracked HammerJS event is emitted, it will propagate the event to the PIXI display object that was hit
 * @param typesArray {string[]}
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
 * Removes all listeners and clears objects.
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
/**
 * Maps a position from the HTMLCanvasElement to a PIXI.Point that corresponds to that location on the Scene Graph
 * @param dstPoint
 * @returns {Point}
 */
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
/**
 * Attempts to retrieve a DisplayObject from the SceneGraph that was hit by a gesture
 * @param center {PIXI.Point} The center point of the Interaction
 * @returns {DisplayObject|null}
 */
Connector.prototype.getPixiTarget = function(center){
	var newCenter = this.normalizePoint(center);
	return this.getHitDisplayObject(newCenter);
}
/**
 * Perform a `hitTest` on the Scene Graph and return the first DisplayObject hit by the interaction event
 * Works for a V5 and V6 InteractionManager and a V7 EventSystem
 * @param center {PIXI.Point}
 * @returns {DisplayObject|null}
 */
Connector.prototype.getHitDisplayObject = function(center) {
	if (!this.isLegacyInteraction()) {
		const boundary = new PIXIEvents.EventBoundary(this.rootDisplayObject);
		return boundary.hitTest(center.x, center.y);
	}

	return this.interactionManager.hitTest(center);
}
/**
 * Dispatches the hammer-* event on the DisplayObject when it is interacted with
 * When used with PIXI V5 or V6, the event will be dispatched using the `InteractionManager.dispatchEvent()` method
 * When used with PIXI V7, the event will be dispatched via the DisplayObject's EventEmitter `emit`.
 * This is because PIXI V7 dispatchEvent method disallows any event that does not conform to its FederatedEvent class
 * @param pixiDisplayObject {DisplayObject} The DisplayObject that was hit by this Interaction
 * @param eventName {string} The hammer-* event name that represents the gesture
 * @param event {Event} The HammerJS event containing gesture data
 */
Connector.prototype.dispatchPixiEvent = function(pixiDisplayObject, eventName, event) {
	if (!this.isLegacyInteraction()) {
		pixiDisplayObject.emit(decorateEvent(event.type), event);
		return;
	}

	this.interactionManager.dispatchEvent(pixiDisplayObject, eventName, event);
}
/**
 * Checks if the current tracked interactionManager field is a EventSystem (PIXI V7) or a InteractionManager (V5 and V6)
 * The InteractionManager in V7 does not have a dispatchEvent method, so we use that to determine capability
 * If interactionManager.dispatchEvent exists, then we are running PIXI V5 or V6
 * If it does _not_ exist, then we are running PIXI V7.
 * @returns {boolean}
 */
Connector.prototype.isLegacyInteraction = function() {
	// @pixi/events doesn't have a dispatchEvent method (that lives on the EventBoundary), so we check for that to determine capability
	return !!this.interactionManager.dispatchEvent;
}

module.exports = Connector;
