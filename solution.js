'use strict';
function Stacker() {

	var EMPTY = 0,
	    WALL = 1,
	    BLOCK = 2,
	    GOLD = 3;
	var DIRECTIONS = ['left', 'up', 'right', 'down'];
	var ACTIONS = ['left', 'up', 'right', 'down', 'pickup', 'drop'];
	var DISQUALIFIED = -1;
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
	var MAP = {};
	var TREASURE_POS = null;
	var ARMS_FULL = false;

	// Evaluation conditions
	var CONDITIONS = {
		// If we dont know where the treasure is, let's not worry about picking up boxes
		isTreastureKnown: function isTreastureKnown(cell) {
			var points = POINT_MAP();
			if (!TREASURE_POS) {
				// Might as well pick one up on our way exploring :P
				points['pickup'] = DISQUALIFIED;
				points['drop'] = DISQUALIFIED;
			}
			return points;
		},
		//armsFull (cell) {
		//	const points = POINT_MAP();
		//	if (ARMS_FULL) {
		//		points['pickup'] = DISQUALIFIED;
		//	} else {
		//		points['drop'] = DISQUALIFIED;
		//	}
		//	return points;
		//},
		// Disqualify walls
		isTraversable: function isTraversable(cell) {
			var points = POINT_MAP();
			for (var direction in DIRECTIONS) {
				var directionName = DIRECTIONS[direction];
				if (directionName && cell[directionName].type === WALL) points[directionName] = DISQUALIFIED;
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
		var highestScore = 0,
		    highestAction = undefined;
		for (var action in POINTS) {
			if (POINTS[action] === DISQUALIFIED) continue;
			// Take an average of all points for this action:
			TALLIED[action] = POINTS[action].reduce(function (a, b) {
				return a + b;
			}) / POINTS[action].length;
			// Mark high score
			if (TALLIED[action] > highestScore) {
				highestScore = TALLIED[action];
				highestAction = action;
			}
		}
		// If we have no preference, random between nondisqualified
		if (highestScore === 0) highestAction = RANDOM_ACTION(Object.keys(TALLIED));

		return highestAction;
	};
}
//# sourceMappingURL=C:\Users\eru\Desktop\graphiq-challenge\solution.js.map