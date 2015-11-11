'use strict';
function Stacker () {

	const	EMPTY = 0, WALL = 1, BLOCK = 2, GOLD = 3;
	const DIRECTIONS = [ 'left', 'up', 'right', 'down' ];
	const ACTIONS = [ 'left', 'up', 'right', 'down', 'pickup', 'drop' ];
	const DISQUALIFIED = -1;
	const RANDOM_ACTION = (actions) => {
		return actions[Math.random() * actions.length >> 0];
	};
	// Create a template point map
	const POINT_MAP = () => {
		let map = {};
		ACTIONS.map((action) => { map[action] = 0 });
		return map;
	}
	// World map data structure
	const MAP = {};
	const TREASURE_POS = null;
	let ARMS_FULL = false;

	// Evaluation conditions
	const CONDITIONS = {
		// If we dont know where the treasure is, let's not worry about picking up boxes
		isTreastureKnown (cell) {
			const points = POINT_MAP();
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
		isTraversable (cell) {
			const points = POINT_MAP();
			for (let direction in DIRECTIONS) {
				let directionName = DIRECTIONS[direction];
				if (directionName && cell[directionName].type === WALL)
					points[directionName] = DISQUALIFIED;
			}
			return points;
		}
	};

	this.turn = function (cell) {
		const POINTS = {}, TALLIED = {};
		ACTIONS.map((action) => { POINTS[action] = [] });

		// Let each condition calcuate a score - tally that into the array created above
		for (let conditionName in CONDITIONS) {
			let ratings = CONDITIONS[conditionName](cell);
			// merge rating with points
			for (let action in ratings) {
				let rating = ratings[action];
				if (rating === DISQUALIFIED) {
					POINTS[action] = DISQUALIFIED;
				} else if (typeof POINTS[action] === 'object') {
					POINTS[action].push(rating);
				}
			}
		}
		// Find highest scoring, nondisqualified action
		let highestScore = 0, highestAction;
		for (let action in POINTS) {
			if (POINTS[action] === DISQUALIFIED) continue;
			// Take an average of all points for this action:
			TALLIED[action] = POINTS[action].reduce((a, b) => { return a + b }) / POINTS[action].length;
			// Mark high score
			if (TALLIED[action] > highestScore) {
				highestScore = TALLIED[action];
				highestAction = action;
			}
		}
		// If we have no preference, random between nondisqualified
		if (highestScore === 0)
			highestAction = RANDOM_ACTION(Object.keys(TALLIED));

		return highestAction;
	}
}
