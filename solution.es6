const Stacker = function () { // eslint-disable-line no-unused-vars
  const EMPTY = 0,
      WALL = 1,
      BLOCK = 2,
      GOLD = 3,
      TREASURE_LEVEL = 8,
      ACTIONS = [ 'left', 'up', 'right', 'down', 'pickup', 'drop' ],
      DIRECTIONS = [ 'left', 'up', 'right', 'down' ],
      DISQUALIFIED = 'DISQUALIFIED',
      TRUMP_CONDITION = 'TRUMP_CONDITION',
      LAST_POS = { x: 0, y: 0 },
      POS = { x: 0, y: 0 },
      ARMS_FULL = false,
      DISCOVERING = true,
      STAIRCASE_MAP = false,
      TREASURE_POS = null,
      randomAction = (actions) => {
        return actions[Math.random() * actions.length >> 0];
      },
      // Create a template point map
      pointMap = () => {
        const map = {};
        ACTIONS.map((action) => {
          map[action] = 0;
        });
        return map;
      },
      isTraversable = (currentCell, desiredCell) => {
        // Disqualify walls
        if (desiredCell.type === WALL) return false;
        // Disqualify heights
        if (desiredCell.level > (currentCell.level + 1)) return false;
        // Everything else is OK
        return true;
      };

  class Map {
    constructor () {
      this.data = {};
      this.blocks = 0;
      this.lowestX = null;
      this.lowestY = null;
      this.highestX = null;
      this.highestY = null;
    }
    addCell (pos, cell) {
      if (this.data[pos.x] === undefined) this.data[pos.x] = {};
      if (this.data[pos.x][pos.y] === undefined) {
        this.blocks++;
        this.data[pos.x][pos.y] = {
          level: cell.level,
          type: cell.type,
          pos
        };
        if (!this.lowestX || pos.x < this.lowestX) this.lowestX = pos.x;
        if (!this.lowestY || pos.y < this.lowestY) this.lowestY = pos.y;
        if (!this.highestX || pos.x > this.highestX) this.highestX = pos.x;
        if (!this.highestY || pos.y > this.highestY) this.highestY = pos.y;
      }
    }
    getCell (pos) {
      if (this.data[pos.x] === undefined) return false;
      if (this.data[pos.x][pos.y] === undefined) return false;
      return this.data[pos.x][pos.y];
    }
    exportCoods () {
      const exported = [];
      let xi = 0;
      for (const x = this.lowestX; x <= this.highestX; x++) {
        let yi = 0;
        exported[xi] = [];
        for (const y = this.lowestY; y <= this.highestY; y++) {
          const target = this.getCell({ x, y });
          if (!target) exported[xi][yi] = 1;
          else if (target.type === WALL) exported[xi][yi] = 1;
          else exported[xi][yi] = 0;
          yi++;
        }
        xi++;
      }
      console.log(exported);
      return exported;
    }
  }

  const map = new Map();

  const buildStaircaseDown = (pos, callback, level = TREASURE_LEVEL, staircase = new Map()) => {
    // We're a staircase!
    if (level === 1) return callback(staircase);
    // Get neighbors
    const left = map.getCell({ x: pos.x - 1, y: pos.y });
    const down = map.getCell({ x: pos.x, y: pos.y - 1 });
    const up = map.getCell({ x: pos.x, y: pos.y + 1 });
    const right = map.getCell({ x: pos.x + 1, y: pos.y });
    const directions = [left, down, up, right];
    for (const i = 0; i < directions.length; i++) {
      const direction = directions[i];
      // If the direction is false it means its not in the map
      if (direction && (direction.type === BLOCK || direction.type === EMPTY)) {
        // Ignore cells that are already part of the staircase
        if (staircase.getCell(direction.pos)) continue;
        staircase.addCell(direction.pos, {
          level: level--,
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
  const CONDITIONS = {
    byDefaultDontDrop () {
      const points = pointMap();
      points.drop = DISQUALIFIED;
      return points;
    },
    // This condition iterates thru each DIRECTION - so a lot of small tasks are done here
    discoverSurroundings (cell) {
      const points = pointMap();
      map.addCell(POS, cell);
      for (const direction in DIRECTIONS) {
        if (!DIRECTIONS.hasOwnProperty(direction)) continue;
        const directionName = DIRECTIONS[direction];
        if (directionName === undefined) continue;
        let directionPos;

        if (directionName === 'left')
          directionPos = { x: POS.x - 1, y: POS.y };
        if (directionName === 'up')
          directionPos = { x: POS.x, y: POS.y + 1 };
        if (directionName === 'right')
          directionPos = { x: POS.x + 1, y: POS.y };
        if (directionName === 'down')
          directionPos = { x: POS.x, y: POS.y - 1 };

        // Find treasure
        if (cell[directionName].type === GOLD) {
          TREASURE_POS = directionPos;
          // DISCOVERING = false;
        }

        // Prefer to move in directions we don't know about
        if (DISCOVERING) {
          if (LAST_POS.x === directionPos.x && LAST_POS.y === directionPos.y)
            points[directionName] = -100;
          if (map.getCell(directionPos) === false) {
            if (cell[directionName].type !== WALL) points[directionName] = 50;
          }
        }

        // Add to map!
        map.addCell(directionPos, cell[directionName]);

        if (isTraversable(cell, cell[directionName]) === false)
          points[directionName] = DISQUALIFIED;
      }
      return points;
    },
    // Always pickup a block if we're standing on it and our arms aren't empty
    dontBeLazy (cell) {
      const points = pointMap();
      if (cell.type === BLOCK && ARMS_FULL === false) points.pickup = 50;
      return points;
    },
    // Design Staircase
    designStaircase () {
      const points = pointMap();
      if (TREASURE_POS && STAIRCASE_MAP === false) {
        STAIRCASE_MAP = true;
        buildStaircaseDown(TREASURE_POS, function (tempDesign) {
          STAIRCASE_MAP = tempDesign;
          map.exportCoods();
        });
      }
      return points;
    },

    buildStaircase () {
      const points = pointMap();
      if (TREASURE_POS && typeof STAIRCASE_MAP === 'object') {
        return TRUMP_CONDITION;
      }
      return points;
    },

    // If we dont know where the treasure is, let's not worry about picking up boxes
    isTreastureKnown () {
      const points = pointMap();
      if (!TREASURE_POS) {
        // Might as well pick one up on our way exploring :P
        //points['pickup'] = DISQUALIFIED;
        points.drop = DISQUALIFIED;
      }
      return points;
    },
    // If our arms are full
    armsFull () {
      const points = pointMap();
      if (ARMS_FULL) points.pickup = DISQUALIFIED;
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
      if (ratings === TRUMP_CONDITION) break;
      // merge rating with points
      for (const action in ratings) {
        if (!ratings.hasOwnProperty(action)) continue;
        const rating = ratings[action];
        if (rating === DISQUALIFIED) {
          POINTS[action] = DISQUALIFIED;
        } else if (typeof POINTS[action] === 'object') {
          POINTS[action].push(rating);
        }
      }
    }
    // Find highest scoring, nondisqualified action
    let highestAction = [], highestActionChoice, highestScore = null;
    for (const action in POINTS) {
      if (POINTS[action] === DISQUALIFIED) continue;
      // Take an average of all points for this action:
      TALLIED[action] = POINTS[action].reduce((a, b) => {
        return a + b;
      }) / POINTS[action].length;
      // Mark high score
      if (TALLIED[action] === highestScore) highestAction.push(action);
      if (TALLIED[action] > highestScore || highestScore === null) {
        highestScore = TALLIED[action];
        highestAction = [ action ];
      }
    }
    // If we have no preference, random between nondisqualified
    if (highestAction.length > 1) highestActionChoice = randomAction(highestAction);
    else highestActionChoice = highestAction[0];

    if (highestActionChoice === 'pickup') ARMS_FULL = true;
    if (highestActionChoice === 'drop') ARMS_FULL = false;
    if (highestActionChoice === 'left') POS.x -= 1;
    if (highestActionChoice === 'up') POS.y += 1;
    if (highestActionChoice === 'right') POS.x += 1;
    if (highestActionChoice === 'down') POS.y -= 1;

    if (POS.x !== LAST_POS.x) LAST_POS.x = POS.x;
    if (POS.y !== LAST_POS.y) LAST_POS.y = POS.y;

    return highestActionChoice;
  };
};
