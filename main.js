// Description: This script is used to update player ratings
// based on the results of the games. It is triggered by
// the onEdit event, which is fired every time a cell is edited
// in the Google spreadsheet.

const GAME_ID_COL = "Номер игры"
const GAME_DATE_COL = "Дата игры"
const PLAYER_COL = "Игрок"
const VISTS_COL = "Висты"
const RATING_BEFORE_COL = "Рейтинг до"
const EXPECTED_RESULT_COL = "Ожидаемый рез-тат"
const RESULT_COL = "Результат"
const RATING_AFTER_COL = "Рейтинг после"


class Games {
  constructor(values) {
    this.validate(values);

    this.columns = this.getColumns(values[0]);
    values.shift();
    this.data = values;
    this.rowsCount = this.data.length;
    this.gamesMapping = this.getGamesMapping();

    this.allIterated = false;
  }

  validate(values) {
    // validate column names at the first row
    const requiredColumns = [GAME_ID_COL, GAME_DATE_COL, PLAYER_COL,
                             VISTS_COL, RATING_BEFORE_COL, EXPECTED_RESULT_COL,
                             RESULT_COL, RATING_AFTER_COL];
    const columns = values[0];
    for (let col of requiredColumns) {
      if (!columns.includes(col)) {
        throw new Error(`Column ${col} is missing`);
      }
    }

    // validate data at least one row
    if (values.length < 2) {
      throw new Error("No data found");
    }
  }

  getColumns(firstRow) {
    // get column indexes by column names
    var columns = {};

    for (let i = 0; i < firstRow.length; i++) {
      const colName = firstRow[i];
      columns[colName] = i;
    }

    return columns
  }

  getGamesMapping() {
    // game id to row indexes
    var gamesMapping = {};
    const idRow = this.columns[GAME_ID_COL];

    for (let i = 0; i < this.rowsCount; i++) {
      const id = this.data[i][idRow];
      if (!gamesMapping[id]) {
        gamesMapping[id] = [];
      }
      gamesMapping[id].push(i);
    }
  return gamesMapping
  }

  getGameIdxs(gameId) {
    // return row indexes for the game
    return this.gamesMapping[gameId];
  }

  getOrderedGameIds() {
    // return ascending ordered list of game ids
    return Object.keys(this.gamesMapping)
    .map(id => Number(id))
    .sort((a, b) => a - b);
  }

  getGameValues(gameId) {
    const rowIdxs = this.gamesMapping[gameId];
    const gameValuesDict = {};

    for (let i of rowIdxs) {
      const player = this.data[i][this.columns[PLAYER_COL]];
      const vists = Number(this.data[i][this.columns[VISTS_COL]]);
      const ratingBefore = Number(this.data[i][this.columns[RATING_BEFORE_COL]]);
      const expectedResult = Number(this.data[i][this.columns[EXPECTED_RESULT_COL]]);
      const result = Number(this.data[i][this.columns[RESULT_COL]]);
      const ratingAfter = Number(this.data[i][this.columns[RATING_AFTER_COL]]);

      if (gameValuesDict[player]) {
        throw new Error(`Duplicate player ${player} in game ${gameId}`);
      }

      gameValuesDict[player] = {"rowId": i,
                                "vists": vists,
                                "ratingBefore": ratingBefore,
                                "expectedResult": expectedResult,
                                "result": result,
                                "ratingAfter": ratingAfter
                                };
      return new GameValues(gameValuesDict, gameId);
    }
  }

  setGameValues(gameValues) {
    if (!gameValues.isFilled) {
      throw new Error(`Game ${gameValues.gameId} is not filled`);
    }

    const gameId = gameValues.gameId;
    const playerValuesDict = gameValues.playerValuesDict;

    for (let playerDict of playerValuesDict) {
      const row = this.data[playerDict.rowId];

      row[this.columns[RATING_BEFORE_COL]] = playerDict.ratingBefore;
      row[this.columns[EXPECTED_RESULT_COL]] = playerDict.expectedResult;
      row[this.columns[RESULT_COL]] = playerDict.result;
      row[this.columns[RATING_AFTER_COL]] = playerDict.ratingAfter;
    }
  }

  setAllIterated() {
    this.allIterated = true;
  }

  getRow(column) {
    return this.data.map(row => row[this.columns[column]]);
  }
}

class GameValues {
  constructor(playerValuesDict, gameId) {
    this.playerValuesDict = playerValuesDict;
    this.gameId = gameId;
    this.isFilled = false;
  }

  getPlayers() {
    // return list of players in the game
    return this.playerValuesDict.map(playerDict => playerDict.player);
  }

  setValuesFromPlayersDict(playerValuesDict) {
    for (let player of playerValuesDict) {
      const playerDictUpdate = playerValuesDict[player];
      const playerDict = this.playerValuesDict[player];

      for (let key in playerDictUpdate) {
        playerDict[key] = playerDictUpdate[key];
      }
    }
    updateIsFilled();
  }

  updateIsFilled() {
    // set isFilled to true if all players have all calculated values filled
    for (let playerDict of this.playerValuesDict) {
      if (!playerDict.ratingBefore ||
          !playerDict.expectedResult ||
          !playerDict.result ||
          !playerDict.ratingAfter) {
        return;
      }
    }
    this.isFilled = true;
  }
}

class GameIterator {
  constructor(games) {
    this.games = games;
    this.gameIds = games.getOrderedGameIds();
    this.currentGameIdx = 0;
    this.isGameUpdatePending = false;
  }

  isFinished() {
    return this.currentGameIdx === this.gameIds.length;
  }

  getNextGame() {
    if (this.isFinished) {
      throw new Error("All games have been processed");
    }
    if (this.isGameUpdatePending) {
      throw new Error(`Game ${this.gameIds[this.currentGameIdx]} has not been updated`);
    }

    const gameId = this.gameIds[this.currentGameIdx];
    const gameValues = this.games.getGameValues(gameId);
    this.isGameUpdatePending = true;
    return gameValues;
  }

  updateGame(gameValues) {
    if (!gameValues.isFilled) {
      throw new Error(`Game ${gameValues.gameId} is not filled`);
    }
    if (gameValues.gameId !== this.gameIds[this.currentGameIdx]) {
      throw new Error(`Game ${gameValues.gameId} is not the current game ${this.gameIds[this.currentGameIdx]}`);
    }

    this.games.setGameValues(gameValues);
    this.currentGameIdx++;
    if (!this.isFinished) {
      this.games.setAllIterated();
    }
    this.isGameUpdatePending = false;
  }
}


function onEdit(e) {
  // Check if the edited range is in the "Игры" sheet
  const gamesPlaceSheetName = "Игры(место)";
  const settingsSheetName = "Настройки";
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== gamesPlaceSheetName) return


  // Load settings from "Настройки" sheet
  const settingsDict = getSettingsDict(spreadsheet.getSheetByName(settingsSheetName))

  // Process ratings update
  updateRatingsPlace(spreadsheet.getSheetByName(gamesPlaceSheetName), settingsDict);
}

function getSettingsDict(sheet) {
  const data = sheet.getDataRange().getValues();
  const settings = {};

  // Loop through the data to populate the dictionary
  for (let i = 0; i < data.length; i++) {
    const key = data[i][0]; // First column contains keys
    const value = data[i][1]; // Second column contains values
    settings[key] = value; // Add to dictionary
  }

  Logger.log(settings)
  return settings;
}

function updateRatingsPlace(sheet, settingsDict) {
  const games = new Games(sheet.getDataRange().getValues(), settingsDict["initialRating"]);
  const gameIterator = new GameIterator(games);

  const playerRatingsCurrent = {};

  while (!gameIterator.isFinished) {
    const gameValues = gameIterator.getNextGame();
    const players = gameValues.getPlayers();

    const playerPairs = [];
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      // initialize player rating
      if (!playerRatingsCurrent[player]) {
        playerRatingsCurrent[player] = Math.round(settingsDict["initialRating"]);
      }

      // split players into pairs: each-to-each
      for (let j = i + 1; j < players.length; j++) {
        const player2 = players[j];
        if (player === player2) continue;
        playerPairs.push([player, player2]);
      }
    }

    // calculate expected results for each player pair
    const expectedResults = {};
    const actualResults = {};
    const difference_divisor = Math.round(settingsDict["difference_divisor"]);
    for (let [player1, player2] of playerPairs) {
      // calculate expected results
      const rating1 = playerRatingsCurrent[player1];
      const rating2 = playerRatingsCurrent[player2];

      if (!expectedResults[player1]) expectedResults[player1] = 0;
      if (!expectedResults[player2]) expectedResults[player2] = 0;

      expectedResults[player1] += 1 / (1 + Math.pow(10, (rating2 - rating1) / difference_divisor));
      expectedResults[player2] += 1 / (1 + Math.pow(10, (rating1 - rating2) / difference_divisor));

      // calculate actual results
      const score1 = gameValues.playerValuesDict[player1].vists;
      const score2 = gameValues.playerValuesDict[player2].vists;

      if (!actualResults[player1]) actualResults[player1] = 0;
      if (!actualResults[player2]) actualResults[player2] = 0;

      // 1 if won, 0.5 if draw, 0 if lost
      actualResults[player1] += score1 > score2 ? 1 : score1 === score2 ? 0.5 : 0;
      actualResults[player2] += score2 > score1 ? 1 : score1 === score2 ? 0.5 : 0;
    }

    const kFactor = Math.round(settingsDict["k-factor"]);
    const playerValuesDict = {}
    for (let player of players) {
      expectedResults[player] /= players.length - 1;
      actualResults[player] /= players.length - 1;

      const ratingDifference = kFactor * (actualResults[player] - expectedResults[player]);
      const ratingNew = playerRatingsCurrent[player] + ratingDifference;

      const playerValues = {
        RATING_BEFORE_COL: playerRatingsCurrent[player],
        EXPECTED_RESULT_COL: expectedResults[player],
        RESULT_COL: actualResults[player],
        RATING_AFTER_COL: ratingNew
      };
      playerValuesDict[player] = playerValues;

      playerRatingsCurrent[player] = ratingNew;
    }
    gameValues.setValuesFromPlayersDict(playerValuesDict);
    gameIterator.updateGame(gameValues);
  }

  // update sheet with filled columns
  for (let col of [RATING_BEFORE_COL, EXPECTED_RESULT_COL, RESULT_COL, RATING_AFTER_COL]) {
    Logger.log("Updating column " + col + ": range (" + 2 + ", " + games.columns[col] + 1 + ", " + games.rowsCount + ", 1)");
    const range = sheet.getRange(2, games.columns[col] + 1, games.rowsCount, 1);
    const row = games.getRow(col);
    range.setValues(row);
  }
}









