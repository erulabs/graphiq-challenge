// GraphIQ challenge
// completed by Seandon Mooy - seandon.mooy@gmail.com
// Written in ES2015

// TODO: Profile the route and conditions systems. A very quick profiling made me suspect I've created a small leak.

// imor's "pathfinding" - https://www.npmjs.com/package/pathfinding
import pathfinding from 'pathfinding';

// We export only one class with one method - the Stacker, with Stacker.turn
const Stacker = function () {
  // Stacker Class Constants and helper functions
  const EMPTY = 0,
      WALL = 1,
      BLOCK = 2,
      GOLD = 3,
      // The Z height of the Treasure.
      TREASURE_LEVEL = 8,
      ACTIONS = [ 'left', 'up', 'right', 'down', 'pickup', 'drop' ],
      DIRECTIONS = [ 'left', 'up', 'right', 'down' ],
      // Used to disqualify actions - used when it's best not left up to vote ratings, such as moving into a wall.
      DISQUALIFIED = 'DISQUALIFIED',
      // Used by conditions to stop the condition evaluation loop - used to short curcuit if we know what we want to do.
      TRUMP_CONDITION = 'TRUMP_CONDITION',
      pathfinder = new pathfinding.AStarFinder({
        allowDiagonal: false,
        dontCrossCorners: true
      }),
      randomChoiceInArray = (arr) => {
        return arr[Math.random() * arr.length >> 0];
      },
      // Create a template point map - might be faster without the .map but I felt like being clever.
      pointMap = () => {
        const map = {};
        ACTIONS.map((action) => {
          map[action] = 0;
        });
        return map;
      },
      // Returns a bool which represents if a cell isTraversable.
      isTraversable = (currentCell, desiredCell) => {
        if (desiredCell.type === WALL) return false;
        if (desiredCell.level > (currentCell.level + 1)) return false;
        return true;
      };

  // Stacker Class variables (all are private since no API other than .turn is required of us).
  let myArmsFull = false,
      myStaircase = false,
      myTreasure = null,
      myRoute = [],
      myTurnCount = 0,
      myLastAction = false,
      // myCurrentStaircaseLevel represents our build progress. We build all tiles up to myCurrentStaircaseLevel then increment by 1 and continue.
      // This prevents us from wanting to build a tile to the point where we couldn't find our way down :O
      myCurrentStaircaseLevel = 1;

  // A helper class which represents a position. It is a glorified x,y coord with syntax helpers.
  // It is here we define the directions and how they co-respond to coords (left, down = negative | right, down = positive)
  class Position {
    constructor (x, y) {
      this.x = parseInt(x, 10);
      this.y = parseInt(y, 10);
    }
    moveLeft () {
      this.x -= 1;
      return this;
    }
    moveUp () {
      this.y += 1;
      return this;
    }
    moveDown () {
      this.y -= 1;
      return this;
    }
    moveRight () {
      this.x += 1;
      return this;
    }
    left () {
      return new Position(this.x - 1, this.y);
    }
    up () {
      return new Position(this.x, this.y + 1);
    }
    down () {
      return new Position(this.x, this.y - 1);
    }
    right () {
      return new Position(this.x + 1, this.y);
    }
  }
  // A class which represents the map - this is used twice - as our bots memory of the world and to hold plans for the staircase.
  class Map {
    constructor () {
      this.data = {};
      this.blocks = 0;
      this.lowestX = 0;
      this.lowestY = 0;
      this.highestX = 0;
      this.highestY = 0;
    }
    // Adds new data to the map, records lowest/highest.
    addCell (pos, cell) {
      if (this.data[pos.x] === undefined) this.data[pos.x] = {};
      if (this.data[pos.x][pos.y] === undefined) {
        this.blocks++;
        this.data[pos.x][pos.y] = {
          level: cell.level,
          type: cell.type,
          pos
        };
        if (pos.x < this.lowestX) this.lowestX = pos.x;
        if (pos.y < this.lowestY) this.lowestY = pos.y;
        if (pos.x > this.highestX) this.highestX = pos.x;
        if (pos.y > this.highestY) this.highestY = pos.y;
      }
    }
    getCell (pos) {
      if (this.data[pos.x] === undefined) return false;
      if (this.data[pos.x][pos.y] === undefined) return false;
      return this.data[pos.x][pos.y];
    }
    // findPath does what it says. In fact all the heavy lifting is done in 'pathfinder.findPath'
    // But the map format conversion (from object with negative indexes to an array of arrays) is very important
    findPath (fromPos, toPos) {
      const exported = [],
          BLOCKED = 1,
          WALKABLE = 0;
      // Export our mapdata as an array
      let yi = 0;
      for (let y = this.highestY; y >= this.lowestY; y--) {
        let xi = 0;
        exported[yi] = [];
        for (let x = this.lowestX; x <= this.highestX; x++) {
          const target = this.getCell({ x, y });
          // Note that we just assume unknown cells are BLOCKED. I kind of wonder if, after this is all complete, it wouldn't be faster to
          // assume they're WALKABLE instead and recalculate if we're wrong. The idea is that we'd perhaps walk "the long way around"
          // because we just haven't descovered the correct way.
          if (!target) exported[yi][xi] = BLOCKED;
          else if (target.type === WALL) exported[yi][xi] = BLOCKED;
          else exported[yi][xi] = WALKABLE;
          xi++;
        }
        yi++;
      }
      // Pass map to the pathfinder, ask for a path and then un-offset the outputs
      const grid = new pathfinding.Grid(exported);
      return pathfinder.findPath(
        fromPos.x - this.lowestX, fromPos.y - this.lowestY,
        toPos.x - this.lowestX, toPos.y - this.lowestY,
        grid
      ).map((coord) => {
        coord[0] += this.lowestX;
        coord[1] += this.lowestY;
        return coord;
      });
    }
  }

  const myLastPosition = new Position(0, 0),
      myPosition = new Position(0, 0),
      map = new Map();

  // Recursive - builds a staircase down from a Position (called initially on the TREASURE)
  const buildStaircaseDown = (pos, callback, level = TREASURE_LEVEL - 1, staircase = new Map()) => {
    // It is complete if it is at ground level
    if (level === 1) return callback(staircase);
    // Find candidate tiles
    for (let i = 0; i < DIRECTIONS.length; i++) {
      // Get the cell in that direction
      const direction = map.getCell(pos[DIRECTIONS[i]]());
      // If the direction is known and a block or empty
      if (direction && (direction.type === BLOCK || direction.type === EMPTY)) {
        // Ignore cells that are already part of the staircase
        if (staircase.getCell(direction.pos)) continue;
        staircase.addCell(direction.pos, {
          level: level--,
          type: BLOCK,
          pos: direction.pos
        });
        buildStaircaseDown(direction.pos, callback, level, staircase);
        break;
      }
    }
  };

  // Evaluation conditions - functions which return undefined or with a vote - an object which contains actions and points
  // After all conditions are evaluated, points are tallied and an action is chosen.
  // Conditions can set an action to DISQUALIFIED, in which case no tallying will take place.
  const CONDITIONS = {
    clearRouteIfWeveMadeItFromTheBottomNowWereHere () {
      if (myRoute.length > 0 && myRoute[0][0] === myPosition.x && myRoute[0][1] === myPosition.y)
        myRoute.shift();
    },
    // This condition iterates thru each DIRECTION - so a lot of small tasks are done here for performance reasons
    discoverSurroundings (cell) {
      const points = pointMap();
      for (let i = 0; i < DIRECTIONS.length; i++) {
        const direction = DIRECTIONS[i];
        const directionPos = myPosition[direction]();
        map.addCell(directionPos, cell[direction]);
        // Prefer to go away from where we came if we have no route (ie: continue in the same direction)
        if (myRoute.length === 0 && myLastAction === direction && myStaircase === false)
          points[myLastAction] = 50;
        // Find treasure
        if (cell[direction].type === GOLD && !myTreasure)
          myTreasure = directionPos;

        // Prefer to move to cells that haven't discovered
        if (map.getCell(directionPos) === false && cell[direction].type !== WALL && myStaircase === false)
          points[direction] = 50;

        if (isTraversable(cell, cell[direction]) === false) {
          points[direction] = DISQUALIFIED;
          //console.log('points1', points);
          continue;
        }
      }
      //console.log('points', points);
      return points;
    },
    // Calls buildStaircaseDown when ready, then uses map.findPath to direct us to the goals!
    designAndBuildTheStaircase () {
      // Only try to build the staircase every 5 turns (throttle our expensive / recursive calls)
      // But there is also a more practical reason - most of the time when we first see the treasure,
      // we don't know much about its surroundings!
      if (myTreasure && myStaircase === false && (myTurnCount % 5 === 0)) {
        buildStaircaseDown(myTreasure, function (tempDesign) {
          if (!myStaircase) myStaircase = tempDesign;
        });
      }
      // Looping over objects like this is expensive and lame. I'm sure this could be more clever.
      if (myStaircase && myArmsFull === true && myRoute.length === 0 && (myTurnCount % 20 === 0)) {
        let target = false;
        for (const x in myStaircase.data) {
          if (!myStaircase.data.hasOwnProperty(x)) continue;
          for (const y in myStaircase.data[x]) {
            if (!myStaircase.data[x].hasOwnProperty(y)) continue;
            const cell = map.getCell({ x, y });
            if (cell.level < myCurrentStaircaseLevel && cell.level <= myStaircase.getCell({ x, y }).level) {
              target = cell.pos;
              break;
            }
          }
          if (target) break;
        }
        if (target) {
          myRoute = map.findPath(myPosition, target);
        }
      }
    },

    // Highly prefer the route!
    followThePathMrRobot () {
      const points = pointMap();
      if (myRoute.length > 0) {
        const target = myRoute[0];
        for (let i = 0; i < DIRECTIONS.length; i++) {
          const direction = DIRECTIONS[i];
          const testTarget = myPosition[direction]();
          if (testTarget.x === target[0] && testTarget.y === target[1]) {
            points[direction] = 2000;
            break;
          }
        }
      }
      return points;
    },
    // Don't waste turns doing impossible things, also, dont pick up parts of the staircase!
    howDoArmsWorkAnyways (cell) {
      const points = pointMap();

      //if (!myTreasure && cell.type === BLOCK && myArmsFull === false)
      //  points.pickup = 50;
      //if (myTreasure && myStaircase) {
      //  if (myArmsFull && myStaircase.getCell(myPosition)) {
      //    if (cell.level < myCurrentStaircaseLevel && cell.level <= myStaircase.getCell(myPosition).level)
      //      points.drop = 500;
      //    points.pickup = DISQUALIFIED;
      //  } else if (!myArmsFull && !myStaircase.getCell(myPosition)) {
      //    points.pickup = 500;
      //  }
      //}

      points.drop = DISQUALIFIED;

      if (cell.type === BLOCK)
        points.pickup = 250;

      if (myTreasure && myStaircase) {
        if (myStaircase.getCell(myPosition)) {
          points.pickup = DISQUALIFIED;
          if (cell.level < myCurrentStaircaseLevel && cell.level < myStaircase.getCell(myPosition).level) {
            points.drop = 500;
          }
        }
      }

      if (myArmsFull) points.pickup = DISQUALIFIED;
      else points.drop = DISQUALIFIED;

      return points;
    }
  };

  this.turn = function (cell) {
    const POINTS = {}, TALLIED = {};
    ACTIONS.map((action) => {
      POINTS[action] = [];
    });
    // Let each condition calcuate a score - tally that into the array created above
    for (const conditionName in CONDITIONS) {
      if (!CONDITIONS.hasOwnProperty(conditionName)) continue;
      const ratings = CONDITIONS[conditionName](cell);
      if (ratings === undefined) continue;
      if (ratings === TRUMP_CONDITION) break;
      // merge rating with points
      for (const action in ratings) {
        if (ratings[action] === DISQUALIFIED)
          POINTS[action] = DISQUALIFIED;
        else if (typeof POINTS[action] === 'object')
          POINTS[action].push(ratings[action]);
      }
    }
    // Find highest scoring, nondisqualified action
    let highestAction = [], highestActionChoice, highestScore = null;
    for (const action in POINTS) {
      if (POINTS[action] === DISQUALIFIED) continue;
      // Take an average of all points for this action:
      TALLIED[action] = POINTS[action].reduce((a, b) => {
        return a + b;
      });
      // Mark high score
      if (TALLIED[action] === highestScore) highestAction.push(action);
      if (TALLIED[action] > highestScore || highestScore === null) {
        highestScore = TALLIED[action];
        highestAction = [ action ];
      }
    }
    // Record last position
    if (myPosition.x !== myLastPosition.x) myLastPosition.x = myPosition.x;
    if (myPosition.y !== myLastPosition.y) myLastPosition.y = myPosition.y;

    // If we have no preference, random between nondisqualified
    if (highestAction.length > 1)
      highestActionChoice = randomChoiceInArray(highestAction);
    else highestActionChoice = highestAction[0];
    // Outcome of our choice should be noted here
    if (highestActionChoice === 'pickup') myArmsFull = true;
    else if (highestActionChoice === 'drop') myArmsFull = false;
    else if (highestActionChoice === 'left') myPosition.moveLeft();
    else if (highestActionChoice === 'up') myPosition.moveUp();
    else if (highestActionChoice === 'right') myPosition.moveRight();
    else if (highestActionChoice === 'down') myPosition.moveDown();
    myTurnCount++;
    myLastAction = highestActionChoice;
    console.log(highestActionChoice);
    return highestActionChoice;
  };
};

// Expose the Stacker class
window.Stacker = Stacker;
