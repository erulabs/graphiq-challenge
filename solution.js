'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function Stacker() {
	var EMPTY = 0,
	    WALL = 1,
	    BLOCK = 2,
	    GOLD = 3,
	    TREASURE_LEVEL = 8;
	var DIRECTIONS = ['left', 'up', 'right', 'down'];
	var ACTIONS = ['left', 'up', 'right', 'down', 'pickup', 'drop'];
	var DISQUALIFIED = 'DISQUALIFIED';
	var TRUMP_CONDITION = 'TRUMP_CONDITION';
	var RANDOM_ACTION = function RANDOM_ACTION(actions) {
		return actions[Math.random() * actions.length >> 0];
	};
	// Create a template point map
	var POINT_MAP = function POINT_MAP() {
		var map = {};
		ACTIONS.map(function (action) {
			map[action] = 0;
		});
		return map;
	};
	// World map data structure
	var POS = { x: 0, y: 0 };
	var LAST_POS = { x: 0, y: 0 };
	var STAIRCASE_MAP = false;
	var TREASURE_POS = null;
	var ARMS_FULL = false;
	var DISCOVERING = true;

	var isTraversable = function isTraversable(currentCell, desiredCell) {
		// Disqualify walls
		if (desiredCell.type === WALL) return false;
		// Disqualify heights
		if (desiredCell.level > currentCell.level + 1) return false;
		// Everything else is OK
		return true;
	};

	var Map = (function () {
		function Map() {
			_classCallCheck(this, Map);

			this.data = {};
			this.blocks = 0;
			this.lowestX = null;
			this.lowestY = null;
			this.highestX = null;
			this.highestY = null;
		}

		_createClass(Map, [{
			key: 'addCell',
			value: function addCell(pos, cell) {
				if (this.data[pos.x] === undefined) this.data[pos.x] = {};
				if (this.data[pos.x][pos.y] === undefined) {
					this.blocks++;
					this.data[pos.x][pos.y] = {
						level: cell.level,
						type: cell.type,
						pos: pos
					};
					if (!this.lowestX || pos.x < this.lowestX) this.lowestX = pos.x;
					if (!this.lowestY || pos.y < this.lowestY) this.lowestY = pos.y;
					if (!this.highestX || pos.x > this.highestX) this.highestX = pos.x;
					if (!this.highestY || pos.y > this.highestY) this.highestY = pos.y;
				}
			}
		}, {
			key: 'getCell',
			value: function getCell(pos) {
				if (this.data[pos.x] === undefined) return false;
				if (this.data[pos.x][pos.y] === undefined) return false;
				return this.data[pos.x][pos.y];
			}
		}, {
			key: 'exportCoods',
			value: function exportCoods() {
				var exported = [];
				var xi = 0;
				for (var x = this.lowestX; x <= this.highestX; x++) {
					var yi = 0;
					exported[xi] = [];
					for (var y = this.lowestY; y <= this.highestY; y++) {
						var target = this.getCell({ x: x, y: y });
						if (!target) exported[xi][yi] = 1;else if (target.type === WALL) exported[xi][yi] = 1;else exported[xi][yi] = 0;
						yi++;
					}
					xi++;
				}
				console.log(exported);
				return exported;
			}
		}]);

		return Map;
	})();

	var map = new Map();

	var buildStaircaseDown = function buildStaircaseDown(pos, callback) {
		var level = arguments.length <= 2 || arguments[2] === undefined ? TREASURE_LEVEL : arguments[2];
		var staircase = arguments.length <= 3 || arguments[3] === undefined ? new Map() : arguments[3];

		// We're a staircase!
		if (level === 1) return callback(staircase);
		// Get neighbors
		var left = map.getCell({ x: pos.x - 1, y: pos.y });
		var down = map.getCell({ x: pos.x, y: pos.y - 1 });
		var up = map.getCell({ x: pos.x, y: pos.y + 1 });
		var right = map.getCell({ x: pos.x + 1, y: pos.y });
		var directions = [left, down, up, right];
		for (var i in directions) {
			var direction = directions[i];
			// If the direction is false it means its not in the map
			if (direction && (direction.type === BLOCK || direction.type === EMPTY)) {
				// Ignore cells that are already part of the staircase
				if (staircase.getCell(direction.pos)) continue;
				level = level - 1;
				staircase.addCell(direction.pos, {
					level: level,
					type: BLOCK,
					pos: direction.pos
				});
				//console.log('built block, current:', staircase)
				buildStaircaseDown(direction.pos, callback, level, staircase);
				break;
			}
		}
	};

	// Evaluation conditions
	var CONDITIONS = {
		byDefaultDontDrop: function byDefaultDontDrop(cell) {
			var points = POINT_MAP();
			points['drop'] = DISQUALIFIED;
			return points;
		},
		// This condition iterates thru each DIRECTION - so a lot of small tasks are done here
		discoverSurroundings: function discoverSurroundings(cell) {
			var points = POINT_MAP();
			map.addCell(POS, cell);
			for (var direction in DIRECTIONS) {
				var directionName = DIRECTIONS[direction];
				if (directionName === undefined) continue;
				var directionPos = undefined;

				if (directionName === 'left') directionPos = { x: POS.x - 1, y: POS.y };
				if (directionName === 'up') directionPos = { x: POS.x, y: POS.y + 1 };
				if (directionName === 'right') directionPos = { x: POS.x + 1, y: POS.y };
				if (directionName === 'down') directionPos = { x: POS.x, y: POS.y - 1 };

				// Find treasure
				if (cell[directionName].type === GOLD) {
					TREASURE_POS = directionPos;
					// DISCOVERING = false;
				}

				// Prefer to move in directions we don't know about
				if (DISCOVERING) {
					if (LAST_POS.x === directionPos.x && LAST_POS.y === directionPos.y) {
						points[directionName] = -100;
					}
					if (map.getCell(directionPos) === false) {
						if (cell[directionName].type !== WALL) {
							points[directionName] = 50;
						}
					}
				}

				// Add to map!
				map.addCell(directionPos, cell[directionName]);

				if (isTraversable(cell, cell[directionName]) === false) points[directionName] = DISQUALIFIED;
			}
			return points;
		},
		// Always pickup a block if we're standing on it and our arms aren't empty
		dontBeLazy: function dontBeLazy(cell) {
			var points = POINT_MAP();
			if (cell.type === BLOCK && ARMS_FULL === false) points['pickup'] = 50;
			return points;
		},
		// Design Staircase
		designStaircase: function designStaircase(cell) {
			var points = POINT_MAP();
			if (TREASURE_POS && STAIRCASE_MAP === false) {
				// Try to build staircase
				STAIRCASE_MAP = true;
				buildStaircaseDown(TREASURE_POS, function (tempDesign) {
					console.log('buildStaircaseDown callback', tempDesign);
					if (tempDesign.blocks < 7) {
						console.log('incomplete map', tempDesign.blocks, 'data:', tempDesign.data);
						STAIRCASE_MAP = false;
					} else {
						STAIRCASE_MAP = tempDesign;
						console.log('final map', tempDesign.data);
						map.exportCoods();
					}
				});
			}
			return points;
		},

		buildStaircase: function buildStaircase(cell) {
			var points = POINT_MAP();
			if (TREASURE_POS && typeof STAIRCASE_MAP === 'object') {

				return TRUMP_CONDITION;
			}
			return points;
		},

		// If we dont know where the treasure is, let's not worry about picking up boxes
		isTreastureKnown: function isTreastureKnown(cell) {
			var points = POINT_MAP();
			if (!TREASURE_POS) {
				// Might as well pick one up on our way exploring :P
				//points['pickup'] = DISQUALIFIED;
				points['drop'] = DISQUALIFIED;
			}
			return points;
		},
		// If our arms are full
		armsFull: function armsFull(cell) {
			var points = POINT_MAP();
			if (ARMS_FULL) {
				points['pickup'] = DISQUALIFIED;
			} else {
				points['drop'] = DISQUALIFIED;
			}
			return points;
		}
	};

	this.turn = function (cell) {
		var POINTS = {},
		    TALLIED = {};
		ACTIONS.map(function (action) {
			POINTS[action] = [];
		});

		// Let each condition calcuate a score - tally that into the array created above
		for (var conditionName in CONDITIONS) {
			var ratings = CONDITIONS[conditionName](cell);
			if (ratings === TRUMP_CONDITION) break;
			// merge rating with points
			for (var action in ratings) {
				var rating = ratings[action];
				if (rating === DISQUALIFIED) {
					POINTS[action] = DISQUALIFIED;
				} else if (typeof POINTS[action] === 'object') {
					POINTS[action].push(rating);
				}
			}
		}
		// Find highest scoring, nondisqualified action
		var highestScore = null,
		    highestAction = [],
		    highestActionChoice = undefined;
		for (var action in POINTS) {
			if (POINTS[action] === DISQUALIFIED) continue;
			// Take an average of all points for this action:
			TALLIED[action] = POINTS[action].reduce(function (a, b) {
				return a + b;
			}) / POINTS[action].length;
			// Mark high score
			if (TALLIED[action] === highestScore) {
				highestAction.push(action);
			}
			if (TALLIED[action] > highestScore || highestScore === null) {
				highestScore = TALLIED[action];
				highestAction = [action];
			}
		}
		// If we have no preference, random between nondisqualified
		if (highestAction.length > 1) highestActionChoice = RANDOM_ACTION(highestAction);else highestActionChoice = highestAction[0];

		//console.log(`now at x,y (${POS.x}, ${POS.y})`)

		LAST_POS.x = POS.x;
		LAST_POS.y = POS.y;

		if (highestActionChoice === 'pickup') ARMS_FULL = true;
		if (highestActionChoice === 'drop') ARMS_FULL = false;
		if (highestActionChoice === 'left') POS.x = POS.x - 1;
		if (highestActionChoice === 'up') POS.y = POS.y + 1;
		if (highestActionChoice === 'right') POS.x = POS.x + 1;
		if (highestActionChoice === 'down') POS.y = POS.y - 1;

		// console.log(highestActionChoice, TALLIED);

		return highestActionChoice;
	};
}
//# sourceMappingURL=C:\Users\eru\Desktop\graphiq-challenge\solution.js.map