const GAME_ID_COL = "Номер игры"
const GAME_DATE_COL = "Дата игры"
const PLAYER_COL = "Игрок"
const VISTS_COL = "Висты"
const RATING_BEFORE_COL = "Рейтинг до"
const EXPECTED_RESULT_COL = "Ожидаемый рез-тат"
const RESULT_COL = "Результат"
const RATING_AFTER_COL = "Рейтинг после"

function onEdit(e) {
  // Check if the edited range is in the "Игры" sheet
  const GamesPlaceSheetName = "Игры(место)";
  const GamesVistsSheetName = "Игры(висты)";
  const settingsSheetName = "Настройки";

  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== GamesVistsSheetName && sheet.getName() !== GamesPlaceSheetName) return

  // Load settings from "Настройки" sheet
  const settingsDict = getSettingsDict(settingsSheetName)
  Logger.log(settingsDict)

  // Process ratings update
  updateRatingsVists(GamesVistsSheetName, settingsDict);
}

function getSettingsDict(settingsSheetName) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(settingsSheetName);
  var data = sheet.getDataRange().getValues();

  var settings = {};

  // Loop through the data to populate the dictionary
  for (var i = 0; i < data.length; i++) {
    var key = data[i][0]; // First column contains keys
    var value = data[i][1]; // Second column contains values
    settings[key] = value; // Add to dictionary

  }

  return settings;
}

function updateRatingsVists(sheetName, settingsDict) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();

  var columns = getColumns(data[0]);
  data.shift();

  var gamesMapping = getGamesMapping(data, columns);  // ordered list of games to list of row indexes
  var gameToScoreRange = getGameToScoreRange(data, columns, gamesMapping);

  //  !!!!!! what for ???????
  var gameToNormalizedIndividualScores = getNormalizedIndividualScores(data, columns, gamesMapping, gameToScoreRange);

  var gameToPlayerRatingsBefore = {};
  var gameToPlayerRatingsAfter = {};

  // calculate ratings game by game
  for (var gameId in gamesMapping) {
    var rowIdxs = gamesMapping[gameId];

    updateGameToPlayerRatingsBefore(settingsDict, gamesMapping, gameToPlayerRatingsAfter)
    var playerRatingsBefore = gameToPlayerRatingsBefore[gameId];

    var playerPairToExpectedScore = getPlayerPairToExpectedScore(playerRatingsBefore);
    var playerPairToActualScore = getPlayerPairToExpectedScore(data, columns, rowIdxs);

    var playerToSumExpectedScores = getPlayerToSumScores(playerPairToExpectedScore);
    var playerToSumActualScores = getPlayerToSumScores(playerPairToActualScore);

    updatePlayerRatingsAfter(
      gameId,
      settingsDict,
      playerRatingsBefore,
      gameToPlayerRatingsAfter,
      playerToSumExpectedScores,
      playerToSumActualScores
      );
  }
  // calculate expected scores (chances of one player to outperform other in a given game)
  // determine actual scores
}

function getColumns(firstRow) {
  var columns = {};

  for (var i = 0; i < firstRow.length; i++) {
    var colName = firstRow[i];
    columns[colName] = i;
  }

  return columns
}

function getGamesMapping(data, columns) {  // game id to row indexes
  var gamesMapping = {};
  var idRow = columns[GAME_ID_COL];

  for (var i = 0; i < data.length; i++) {
    var id = data[i][idRow];

    if (!gamesMapping[id]) {
      gamesMapping[id] = [];
    }

    gamesMapping[id].push(i);
  }
  Logger.log(gamesMapping)
}

function getGameToScoreRange(data, columns, gamesMapping) {
  // score range for each game
  // max vists + abs min vists
  var gameToScoreRange = {};

  for (var gameId in gamesMapping) {
    var minVists = 0;
    var maxVists = 0;

    var rowIdxs = gamesMapping[gameId]
    rowIdxs.forEach(function(rowId) {
      var vists = data[columns[VISTS_COL]];
      if (vists > maxVists) {maxVists = vists};
      if (vists < minVists) {minVists = vists};
    });

    var range = maxVists - minVists;  // min vists are always <= 0
    gameToScoreRange[gameId] = range;
  }
}

function getNormalizedIndividualScores(data, columns, gamesMapping, gameToScoreRange) {
  var normalizedIndividualScores = {}

  for (var gameId in gamesMapping) {
    normalizedIndividualScores[gameId] = {};

    var rowIdxs = gamesMapping[gameId];
    rowIdxs.forEach(function(rowId) {
      var vists = data[columns[VISTS_COL]];
      var player = data[columns[PLAYER_COL]];
      var normalizedScore = vists / gameToScoreRange[gameId];
      normalizedIndividualScores[gameId][player] = normalizedScore;
    });
  }
  return normalizedIndividualScores;
}










