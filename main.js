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
  constructor(values, ratingDefault) {
    this.validate(values);

    this.columns = this.getColumns(values[0]);
    values.shift();
    this.data = values;
    this.rowsCount = this.data.length;
    this.gamesMapping = this.getGamesMapping();

    this.ratingDefault = ratingDefault;
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
    }
  }

//  getGameResults(gameId) {
//    // return sorted game results [{player: "name1", score: 111},..]
//    const gameResults = [];
//    const rowIdxs = this.gamesMapping[gameId];
//    for (let i of rowIdxs) {
//      const player = this.data[i][this.columns[PLAYER_COL]];
//      const score = Number(this.data[i][this.columns[RESULT_COL]]);
//      gameResults.push({"player": player, "score": score});
//    }
//    if (gameResults.length < 3 || gameResults.length > 5) {
//      throw new Error(`Invalid number of players for game ${gameId}: ${gameResults.length}`);
//    }
//    return gameResults;
//  }

  setValueForPlayer(gameId, player, colName, value) {
    // set value for player in the game
    const rowIdxs = this.gamesMapping[gameId];
    for (let i of rowIdxs) {
      if (this.data[i][this.columns[PLAYER_COL]] === player) {
        this.data[i][this.columns[colName]] = value;
        return;
      }
    }
    throw new Error(`Player ${player} not found in game ${gameId}`);
  }

  setRatingBefore(gameId, player, rating) {
    // set rating before the game
    this.setValueForPlayer(gameId, player, RATING_BEFORE_COL, rating);
  }

  setRatingAfter(gameId, player, rating) {
      // set rating after the game
      this.setValueForPlayer(gameId, player, RATING_AFTER_COL, rating);
  }

  setExpectedResult(gameId, player, result) {
      // set expected result for the player
      this.setValueForPlayer(gameId, player, EXPECTED_RESULT_COL, result);
  }

  setResult(gameId, player, result) {
      // set actual result for the player
      this.setValueForPlayer(gameId, player, RESULT_COL, result);
  }


class GameValues {
    constructor(playerValuesDict, gameId) {
        this.playerValuesDict = playerValuesDict;
        this.gameId = gameId;
    }

    getPlayers {
      // return list of players in the game
        return this.playerValuesDict.map(playerDict => playerDict.player);
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

  var playerRatingsCurrent = {};

  for (gameId of games.getOrderedGameIds()) {
    const gameResults = games.getGameResults(gameId);
    const playerRatingsBefore = getAndFillPlayerRatingsCurrent(settingsDict, playerRatingsCurrent, gameResults);

    for (let playerDict of gameResults) {
      const player = playerDict.player;
      const ratingBefore = playerRatingsBefore[player];
      const ratingAfter = playerRatingsCurrent[player];
      const score = playerDict.score;

      const expectedResult = calculateExpectedResult(playerRatingsBefore, player);
      const newRating = calculateNewRating(ratingBefore, ratingAfter, score, expectedResult, settingsDict);

      games.setRatingAfter(gameId, player, newRating);
      playerRatingsCurrent[player] = newRating;
    }
  }
}

// Create a class GameIterator that accepts Games object instance.
// It returns an iterator that yields gameId

function getAndFillPlayerRatingsCurrent(settingsDict, playerRatingsCurrent, gameResults) {
  // return player ratings in the form of {player: rating}
  // fill data with player ratings before the game
  var playerRatingsBefore = {};

  for (let playerDict of gameResults) {
    const player = playerDict.player;

    if (!playerRatingsCurrent[player]) {
      playerRatingsCurrent[player] = Math.round(settingsDict["initialRating"]);
    }
    playerRatingsBefore[player] = playerRatingsCurrent[player];
  }

  return playerRatingsBefore;
}







