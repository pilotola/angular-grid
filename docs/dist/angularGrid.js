(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var SvgFactory = require('../svgFactory');
var utils = require('../utils');
var svgFactory = new SvgFactory();

function groupCellRendererFactory(gridOptionsWrapper, selectionRendererFactory) {

    return function groupCellRenderer(params) {

        var eGroupCell = document.createElement('span');
        var node = params.node;

        var expandIconNeeded = node.group && !node.footer;
        if (expandIconNeeded) {
            var eExpandIcon = createGroupExpandIcon(node.expanded);
            eGroupCell.appendChild(eExpandIcon);
            eExpandIcon.addEventListener("click", function () {
                expandGroup(node, params);
            });
        }

        var checkboxNeeded = params.colDef && params.colDef.cellRenderer && params.colDef.cellRenderer.checkbox && !node.footer;
        if (checkboxNeeded) {
            var eCheckbox = selectionRendererFactory.createSelectionCheckbox(node, params.rowIndex);
            eGroupCell.appendChild(eCheckbox);
        }

        if (params.colDef && params.colDef.cellRenderer && params.colDef.cellRenderer.innerRenderer) {
            createFromInnerRenderer(eGroupCell, params, params.colDef.cellRenderer.innerRenderer);
        } else if (node.footer) {
            createFooterCell(eGroupCell, node);
        } else if (node.group) {
            createGroupCell(eGroupCell, node);
        } else {
            createLeafCell(eGroupCell, params);
        }

        // only do this if an indent - as this overwrites the padding that
        // the theme set, which will make things look 'not aligned' for the
        // first group level.
        if (node.footer || node.level > 0) {
            var paddingPx = node.level * 10;
            if (node.footer) {
                paddingPx += 10;
            } else if (!node.group) {
                paddingPx += 5;
            }
            eGroupCell.style.paddingLeft = paddingPx + "px";
        }

        if (node.group) {
            eGroupCell.addEventListener("dblclick", function () {
                expandGroup(node, params);
            });
        }

        return eGroupCell;
    };

    function createFromInnerRenderer(eGroupCell, params, renderer) {
        utils.useRenderer(eGroupCell, renderer, params);
    }

    function expandGroup(node, params) {
        node.expanded = !node.expanded;
        params.api.onGroupExpandedOrCollapsed();
    }

    function createGroupExpandIcon(expanded) {
        if (expanded) {
            return utils.createIcon('groupExpanded', gridOptionsWrapper, null, svgFactory.createArrowDownSvg);
        } else {
            return utils.createIcon('groupContracted', gridOptionsWrapper, null, svgFactory.createArrowRightSvg);
        }
    }

    // creates cell with 'Total {{key}}' for a group
    function createFooterCell(eParent, node) {
        var textToDisplay = "Total " + node.key;
        var eText = document.createTextNode(textToDisplay);
        eParent.appendChild(eText);
    }

    // creates cell with '{{key}} ({{childCount}})' for a group
    function createGroupCell(eParent, node) {
        var textToDisplay = " " + node.key;
        // only include the child count if it's included, eg if user doing custom aggregation,
        // then this could be left out, or set to -1, ie no child count
        if (node.allChildrenCount >= 0) {
            textToDisplay += " (" + node.allChildrenCount + ")";
        }
        var eText = document.createTextNode(textToDisplay);
        eParent.appendChild(eText);
    }


    // creates cell with '{{key}} ({{childCount}})' for a group
    function createLeafCell(eParent, params) {
        if (params.value) {
            var eText = document.createTextNode(' ' + params.value);
            eParent.appendChild(eText);
        }
    }
}

module.exports = groupCellRendererFactory;
},{"../svgFactory":23,"../utils":27}],2:[function(require,module,exports){
var constants = require('./constants');

function ColumnController() {
    this.createModel();
}

ColumnController.prototype.init = function(angularGrid, selectionRendererFactory, gridOptionsWrapper) {
    this.gridOptionsWrapper = gridOptionsWrapper;
    this.angularGrid = angularGrid;
    this.selectionRendererFactory = selectionRendererFactory;
};

ColumnController.prototype.createModel = function() {
    var that = this;
    this.model = {
        // used by:
        // + inMemoryRowController -> sorting, building quick filter text
        // + headerRenderer -> sorting (clearing icon)
        getAllColumns: function() {
            return that.columns;
        },
        // + rowController -> while inserting rows, and when tabbing through cells (need to change this)
        // need a newMethod - get next col index
        getVisibleColumns: function() {
            return that.visibleColumns;
        },
        // used by:
        // + angularGrid -> for setting body width
        // + rowController -> setting main row widths (when inserting and resizing)
        getBodyContainerWidth: function() {
            return that.getTotalColWidth(false);
        },
        // used by:
        // + angularGrid -> setting pinned body width
        getPinnedContainerWidth: function() {
            return that.getTotalColWidth(true);
        },
        // used by:
        // + headerRenderer -> setting pinned body width
        getColumnGroups: function() {
            return that.columnGroups;
        },
        // used by:
        // + rowRenderer -> for navigation
        getVisibleColBefore: function(col) {
            var oldIndex = that.visibleColumns.indexOf(col);
            if (oldIndex > 0) {
                return that.visibleColumns[oldIndex - 1];
            } else {
                return null;
            }
        },
        // used by:
        // + rowRenderer -> for navigation
        getVisibleColAfter: function(col) {
            var oldIndex = that.visibleColumns.indexOf(col);
            if (oldIndex < (that.visibleColumns.length - 1)) {
                return that.visibleColumns[oldIndex + 1];
            } else {
                return null;
            }
        }
    };
};

ColumnController.prototype.getModel = function() {
    return this.model;
};

// called by angularGrid
ColumnController.prototype.setColumns = function(columnDefs) {
    this.buildColumns(columnDefs);
    this.ensureEachColHasSize();
    this.buildGroups();
    this.updateGroups();
    this.updateVisibleColumns();
};

// called by headerRenderer - when a header is opened or closed
ColumnController.prototype.columnGroupOpened = function(group) {
    group.expanded = !group.expanded;
    this.updateGroups();
    this.updateVisibleColumns();
    this.angularGrid.refreshHeaderAndBody();
};

// private
ColumnController.prototype.updateVisibleColumns = function() {
    // if not grouping by headers, then all columns are visible
    if (!this.gridOptionsWrapper.isGroupHeaders()) {
        this.visibleColumns = this.columns;
        return;
    }

    // if grouping, then only show col as per group rules
    this.visibleColumns = [];
    for (var i = 0; i < this.columnGroups.length; i++) {
        var group = this.columnGroups[i];
        group.addToVisibleColumns(this.visibleColumns);
    }
};

// public - called from api
ColumnController.prototype.sizeColumnsToFit = function(gridWidth) {
    // avoid divide by zero
    if (gridWidth <= 0 || this.visibleColumns.length === 0) {
        return;
    }

    var columnStartWidth = 0; // will contain the starting total width of the cols been spread
    var colsToSpread = []; // all visible cols, except those with avoidSizeToFit
    var widthForSpreading = gridWidth; // grid width minus the columns we are not resizing

    // get the list of cols to work with
    for (var j = 0; j < this.visibleColumns.length ; j++) {
        if (this.visibleColumns[j].colDef.suppressSizeToFit === true) {
            // don't include col, and remove the width from teh available width
            widthForSpreading -= this.visibleColumns[j].actualWidth;
        } else {
            // include the col
            colsToSpread.push(this.visibleColumns[j]);
            columnStartWidth += this.visibleColumns[j].actualWidth;
        }
    }

    // if no width left over to spread with, do nothing
    if (widthForSpreading <= 0) {
        return;
    }

    var scale = widthForSpreading / columnStartWidth;
    var pixelsForLastCol = widthForSpreading;

    // size all cols except the last by the scale
    for (var i = 0; i < (colsToSpread.length - 1); i++) {
        var column = colsToSpread[i];
        var newWidth = parseInt(column.actualWidth * scale);
        column.actualWidth = newWidth;
        pixelsForLastCol -= newWidth;
    }

    // size the last by whats remaining (this avoids rounding errors that could
    // occur with scaling everything, where it result in some pixels off)
    var lastColumn = colsToSpread[colsToSpread.length - 1];
    lastColumn.actualWidth = pixelsForLastCol;

    // widths set, refresh the gui
    this.angularGrid.refreshHeaderAndBody();
};

// private
ColumnController.prototype.buildGroups = function() {
    // if not grouping by headers, do nothing
    if (!this.gridOptionsWrapper.isGroupHeaders()) {
        this.columnGroups = null;
        return;
    }

    // split the columns into groups
    var currentGroup = null;
    this.columnGroups = [];
    var that = this;

    var lastColWasPinned = true;

    this.columns.forEach(function(column) {
        // do we need a new group, because we move from pinned to non-pinned columns?
        var endOfPinnedHeader = lastColWasPinned && !column.pinned;
        if (!column.pinned) {
            lastColWasPinned = false;
        }
        // do we need a new group, because the group names doesn't match from previous col?
        var groupKeyMismatch = currentGroup && column.colDef.group !== currentGroup.name;
        // we don't group columns where no group is specified
        var colNotInGroup = currentGroup && !currentGroup.name;
        // do we need a new group, because we are just starting
        var processingFirstCol = column.index === 0;
        var newGroupNeeded = processingFirstCol || endOfPinnedHeader || groupKeyMismatch || colNotInGroup;
        // create new group, if it's needed
        if (newGroupNeeded) {
            var pinned = column.pinned;
            currentGroup = new ColumnGroup(pinned, column.colDef.group);
            that.columnGroups.push(currentGroup);
        }
        currentGroup.addColumn(column);
    });
};

// private
ColumnController.prototype.updateGroups = function() {
    // if not grouping by headers, do nothing
    if (!this.gridOptionsWrapper.isGroupHeaders()) {
        return;
    }

    for (var i = 0; i < this.columnGroups.length; i++) {
        var group = this.columnGroups[i];
        group.calculateExpandable();
        group.calculateVisibleColumns();
    }
};

// private
ColumnController.prototype.buildColumns = function(columnDefs) {
    this.columns = [];
    var that = this;
    var pinnedColumnCount = this.gridOptionsWrapper.getPinnedColCount();
    if (columnDefs) {
        for (var i = 0; i < columnDefs.length; i++) {
            var colDef = columnDefs[i];
            // this is messy - we swap in another col def if it's checkbox selection - not happy :(
            if (colDef === 'checkboxSelection') {
                colDef = that.selectionRendererFactory.createCheckboxColDef();
            }
            var pinned = pinnedColumnCount > i;
            var column = new Column(colDef, i, pinned);
            that.columns.push(column);
        }
    }
};

// private
// set the actual widths for each col
ColumnController.prototype.ensureEachColHasSize = function() {
    var defaultWidth = this.gridOptionsWrapper.getColWidth();
    if (typeof defaultWidth !== 'number' || defaultWidth < constants.MIN_COL_WIDTH) {
        defaultWidth = 200;
    }
    this.columns.forEach(function(colDefWrapper) {
        var colDef = colDefWrapper.colDef;
        if (colDefWrapper.actualWidth) {
            // if actual width already set, do nothing
            return;
        } else if (!colDef.width) {
            // if no width defined in colDef, default to 200
            colDefWrapper.actualWidth = defaultWidth;
        } else if (colDef.width < constants.MIN_COL_WIDTH) {
            // if width in col def to small, set to min width
            colDefWrapper.actualWidth = constants.MIN_COL_WIDTH;
        } else {
            // otherwise use the provided width
            colDefWrapper.actualWidth = colDef.width;
        }
    });
};

// private
// call with true (pinned), false (not-pinned) or undefined (all columns)
ColumnController.prototype.getTotalColWidth = function(includePinned) {
    var widthSoFar = 0;
    var pinedNotImportant = typeof includePinned !== 'boolean';

    this.visibleColumns.forEach(function(column) {
        var includeThisCol = pinedNotImportant || column.pinned === includePinned;
        if (includeThisCol) {
            widthSoFar += column.actualWidth;
        }
    });

    return widthSoFar;
};

function ColumnGroup(pinned, name) {
    this.pinned = pinned;
    this.name = name;
    this.allColumns = [];
    this.visibleColumns = [];
    this.expandable = false; // whether this group can be expanded or not
    this.expanded = false;
}

ColumnGroup.prototype.addColumn = function(column) {
    this.allColumns.push(column);
};

// need to check that this group has at least one col showing when both expanded and contracted.
// if not, then we don't allow expanding and contracting on this group
ColumnGroup.prototype.calculateExpandable = function() {
    // want to make sure the group doesn't disappear when it's open
    var atLeastOneShowingWhenOpen = false;
    // want to make sure the group doesn't disappear when it's closed
    var atLeastOneShowingWhenClosed = false;
    // want to make sure the group has something to show / hide
    var atLeastOneChangeable = false;
    for (var i = 0, j = this.allColumns.length; i < j; i++) {
        var column = this.allColumns[i];
        if (column.colDef.groupShow === 'open') {
            atLeastOneShowingWhenOpen = true;
            atLeastOneChangeable = true;
        } else if (column.colDef.groupShow === 'closed') {
            atLeastOneShowingWhenClosed = true;
            atLeastOneChangeable = true;
        } else {
            atLeastOneShowingWhenOpen = true;
            atLeastOneShowingWhenClosed = true;
        }
    }

    this.expandable = atLeastOneShowingWhenOpen && atLeastOneShowingWhenClosed && atLeastOneChangeable;
};

ColumnGroup.prototype.calculateVisibleColumns = function() {
    // clear out last time we calculated
    this.visibleColumns = [];
    // it not expandable, everything is visible
    if (!this.expandable) {
        this.visibleColumns = this.allColumns;
        return;
    }
    // and calculate again
    for (var i = 0, j = this.allColumns.length; i < j; i++) {
        var column = this.allColumns[i];
        switch (column.colDef.groupShow) {
            case 'open':
                // when set to open, only show col if group is open
                if (this.expanded) {
                    this.visibleColumns.push(column);
                }
                break;
            case 'closed':
                // when set to open, only show col if group is open
                if (!this.expanded) {
                    this.visibleColumns.push(column);
                }
                break;
            default:
                // default is always show the column
                this.visibleColumns.push(column);
                break;
        }
    }
};

ColumnGroup.prototype.addToVisibleColumns = function(allVisibleColumns) {
    for (var i = 0; i < this.visibleColumns.length; i++) {
        var column = this.visibleColumns[i];
        allVisibleColumns.push(column);
    }
};

function Column(colDef, index, pinned) {
    this.colDef = colDef;
    this.index = index;
    this.pinned = pinned;
    // in the future, the colKey might be something other than the index
    this.colKey = index;
}

module.exports = ColumnController;

},{"./constants":3}],3:[function(require,module,exports){
var constants = {
    STEP_EVERYTHING: 0,
    STEP_FILTER: 1,
    STEP_SORT: 2,
    STEP_MAP: 3,
    ASC: "asc",
    DESC: "desc",
    ROW_BUFFER_SIZE: 20,
    SORT_STYLE_SHOW: "display:inline;",
    SORT_STYLE_HIDE: "display:none;",
    MIN_COL_WIDTH: 10
};

module.exports = constants;

},{}],4:[function(require,module,exports){
function ExpressionService() {}

ExpressionService.prototype.evaluate = function(rule, params) {
};

function ExpressionService() {
    this.expressionToFunctionCache = {};
}

ExpressionService.prototype.evaluate = function (expression, params) {

    try {
        var javaScriptFunction = this.createExpressionFunction(expression);
        var result = javaScriptFunction(params.value, params.context, params.node,
            params.data, params.colDef, params.rowIndex, params.api);
        return result;
    } catch (e) {
        // the expression failed, which can happen, as it's the client that
        // provides the expression. so print a nice message
        console.error('Processing of the expression failed');
        console.error('Expression = ' + expression);
        console.error('Exception = ' + e);
        return null;
    }
};

ExpressionService.prototype.createExpressionFunction = function (expression) {
    // check cache first
    if (this.expressionToFunctionCache[expression]) {
        return this.expressionToFunctionCache[expression];
    }
    // if not found in cache, return the function
    var functionBody = this.createFunctionBody(expression);
    var theFunction = new Function('x, ctx, node, data, colDef, rowIndex, api', functionBody);

    // store in cache
    this.expressionToFunctionCache[expression] = theFunction;

    return theFunction;
};

ExpressionService.prototype.createFunctionBody = function (expression) {
    // if the expression has the 'return' word in it, then use as is,
    // if not, then wrap it with return and ';' to make a function
    if (expression.indexOf('return') >= 0) {
        return expression;
    } else {
        return 'return ' + expression + ';';
    }
};

module.exports = ExpressionService;

},{}],5:[function(require,module,exports){
var utils = require('./../utils');
var SetFilter = require('./setFilter');
var NumberFilter = require('./numberFilter');
var StringFilter = require('./textFilter');

function FilterManager() {}

FilterManager.prototype.init = function(grid, gridOptionsWrapper, $compile, $scope) {
    this.$compile = $compile;
    this.$scope = $scope;
    this.gridOptionsWrapper = gridOptionsWrapper;
    this.grid = grid;
    this.allFilters = {};
};

FilterManager.prototype.setRowModel = function(rowModel) {
    this.rowModel = rowModel;
};

FilterManager.prototype.createFilter = function(colDefWrapper){
    var filterWrapper = this.allFilters[colDefWrapper.colKey];
    var colDef = colDefWrapper.colDef;

    if (!filterWrapper) {
        filterWrapper = {
            colKey: colDefWrapper.colKey,
            field: colDef.field
        };
        var filterChangedCallback = this.grid.onFilterChanged.bind(this.grid);
        var filterParams = colDef.filterParams;
        var params = {
            colDef: colDef,
            rowModel: this.rowModel,
            filterChangedCallback: filterChangedCallback,
            filterParams: filterParams,
            scope: filterWrapper.scope
        };
        if (typeof colDef.filter === 'function') {
            // if user provided a filter, just use it
            // first up, create child scope if needed
            if (this.gridOptionsWrapper.isAngularCompileFilters()) {
                var scope = this.$scope.$new();
                filterWrapper.scope = scope;
                params.$scope = scope;
            }
            // now create filter
            filterWrapper.filter = new colDef.filter(params);
        } else if (colDef.filter === 'text') {
            filterWrapper.filter = new StringFilter(params);
        } else if (colDef.filter === 'number') {
            filterWrapper.filter = new NumberFilter(params);
        } else {
            filterWrapper.filter = new SetFilter(params);
        }
        this.allFilters[colDefWrapper.colKey] = filterWrapper;

        if (!filterWrapper.filter.getGui) { // because users can do custom filters, give nice error message
            console.error('Filter is missing method getGui');
        }

        var eFilterGui = document.createElement('div');
        eFilterGui.className = 'ag-filter';
        var guiFromFilter = filterWrapper.filter.getGui();
        if (utils.isNodeOrElement(guiFromFilter)) {
            //a dom node or element was returned, so add child
            eFilterGui.appendChild(guiFromFilter);
        } else {
            //otherwise assume it was html, so just insert
            var eTextSpan = document.createElement('span');
            eTextSpan.innerHTML = guiFromFilter;
            eFilterGui.appendChild(eTextSpan);
        }

        if (filterWrapper.scope) {
            filterWrapper.gui = this.$compile(eFilterGui)(filterWrapper.scope)[0];
        } else {
            filterWrapper.gui = eFilterGui;
        }

    }
};

// returns true if at least one filter is active
FilterManager.prototype.isFilterPresent = function() {
    var atLeastOneActive = false;
    var that = this;

    var keys = Object.keys(this.allFilters);
    keys.forEach(function(key) {
        var filterWrapper = that.allFilters[key];
        if (!filterWrapper.filter.isFilterActive) { // because users can do custom filters, give nice error message
            console.error('Filter is missing method isFilterActive');
        }
        if (filterWrapper.filter.isFilterActive()) {
            atLeastOneActive = true;
        }
    });
    return atLeastOneActive;
};

// returns true if given col has a filter active
FilterManager.prototype.isFilterPresentForCol = function(colKey) {
    var filterWrapper = this.allFilters[colKey];
    if (!filterWrapper) {
        return false;
    }
    if (!filterWrapper.filter.isFilterActive) { // because users can do custom filters, give nice error message
        console.error('Filter is missing method isFilterActive');
    }
    var filterPresent = filterWrapper.filter.isFilterActive();
    return filterPresent;
};

FilterManager.prototype.doesFilterPass = function(node) {
    var data = node.data;
    var colKeys = Object.keys(this.allFilters);
    for (var i = 0, l = colKeys.length; i < l; i++) { // critical code, don't use functional programming

        var colKey = colKeys[i];
        var filterWrapper = this.allFilters[colKey];

        // if no filter, always pass
        if (filterWrapper === undefined) {
            continue;
        }

        var value = data[filterWrapper.field];
        if (!filterWrapper.filter.doesFilterPass) { // because users can do custom filters, give nice error message
            console.error('Filter is missing method doesFilterPass');
        }
        var model;
        // if model is exposed, grab it
        if (filterWrapper.filter.getModel) {
            model = filterWrapper.filter.getModel();
        }
        var params = {
            value: value,
            model: model,
            node: node,
            data: data
        };
        if (!filterWrapper.filter.doesFilterPass(params)) {
            return false;
        }
    }
    // all filters passed
    return true;
};

FilterManager.prototype.onNewRowsLoaded = function() {
    var that = this;
    Object.keys(this.allFilters).forEach(function(field) {
        var filter = that.allFilters[field].filter;
        if (filter.onNewRowsLoaded) {
            filter.onNewRowsLoaded();
        }
    });
};

FilterManager.prototype.positionPopup = function(eventSource, ePopup, ePopupRoot) {
    var sourceRect = eventSource.getBoundingClientRect();
    var parentRect = ePopupRoot.getBoundingClientRect();

    var x = sourceRect.left - parentRect.left;
    var y = sourceRect.top - parentRect.top + sourceRect.height;

    // if popup is overflowing to the right, move it left
    var widthOfPopup = 200; // this is set in the css
    var widthOfParent = parentRect.right - parentRect.left;
    var maxX = widthOfParent - widthOfPopup - 20; // 20 pixels grace
    if (x > maxX) { // move position left, back into view
        x = maxX;
    }
    if (x < 0) { // in case the popup has a negative value
        x = 0;
    }

    ePopup.style.left = x + "px";
    ePopup.style.top = y + "px";
};

FilterManager.prototype.showFilter = function(colDefWrapper, eventSource) {

    var filterWrapper = this.allFilters[colDefWrapper.colKey];
    var colDef = colDefWrapper.colDef;

    if (!filterWrapper) {
        filterWrapper = {
            colKey: colDefWrapper.colKey,
            field: colDef.field
        };
        var filterChangedCallback = this.grid.onFilterChanged.bind(this.grid);
        var filterParams = colDef.filterParams;
        var params = {
            colDef: colDef,
            rowModel: this.rowModel,
            filterChangedCallback: filterChangedCallback,
            filterParams: filterParams,
            scope: filterWrapper.scope
        };
        if (typeof colDef.filter === 'function') {
            // if user provided a filter, just use it
            // first up, create child scope if needed
            if (this.gridOptionsWrapper.isAngularCompileFilters()) {
                var scope = this.$scope.$new();
                filterWrapper.scope = scope;
                params.$scope = scope;
            }
            // now create filter
            filterWrapper.filter = new colDef.filter(params);
        } else if (colDef.filter === 'text') {
            filterWrapper.filter = new StringFilter(params);
        } else if (colDef.filter === 'number') {
            filterWrapper.filter = new NumberFilter(params);
        } else {
            filterWrapper.filter = new SetFilter(params);
        }
        this.allFilters[colDefWrapper.colKey] = filterWrapper;

        if (!filterWrapper.filter.getGui) { // because users can do custom filters, give nice error message
            console.error('Filter is missing method getGui');
        }

        var eFilterGui = document.createElement('div');
        eFilterGui.className = 'ag-filter';
        var guiFromFilter = filterWrapper.filter.getGui();
        if (utils.isNodeOrElement(guiFromFilter)) {
            //a dom node or element was returned, so add child
            eFilterGui.appendChild(guiFromFilter);
        } else {
            //otherwise assume it was html, so just insert
            var eTextSpan = document.createElement('span');
            eTextSpan.innerHTML = guiFromFilter;
            eFilterGui.appendChild(eTextSpan);
        }

        if (filterWrapper.scope) {
            filterWrapper.gui = this.$compile(eFilterGui)(filterWrapper.scope)[0];
        } else {
            filterWrapper.gui = eFilterGui;
        }

    }

    var ePopupParent = this.grid.getPopupParent();
    this.positionPopup(eventSource, filterWrapper.gui, ePopupParent);

    utils.addAsModalPopup(ePopupParent, filterWrapper.gui);

    if (filterWrapper.filter.afterGuiAttached) {
        filterWrapper.filter.afterGuiAttached();
    }
};

module.exports = FilterManager;

},{"./../utils":27,"./numberFilter":6,"./setFilter":8,"./textFilter":11}],6:[function(require,module,exports){
var utils = require('./../utils');
var template = require('./numberFilterTemplate.js');

var EQUALS = 1;
var LESS_THAN = 2;
var GREATER_THAN = 3;

function NumberFilter(params) {
    this.filterChangedCallback = params.filterChangedCallback;
    this.createGui();
    this.filterNumber = null;
    this.filterType = EQUALS;
}

/* public */
NumberFilter.prototype.afterGuiAttached = function() {
    this.eFilterTextField.focus();
};

/* public */
NumberFilter.prototype.doesFilterPass = function(node) {
    if (this.filterNumber === null) {
        return true;
    }
    var value = node.value;

    if (!value && value !== 0) {
        return false;
    }

    var valueAsNumber;
    if (typeof value === 'number') {
        valueAsNumber = value;
    } else {
        valueAsNumber = parseFloat(value);
    }

    switch (this.filterType) {
        case EQUALS:
            return valueAsNumber === this.filterNumber;
        case LESS_THAN:
            return valueAsNumber <= this.filterNumber;
        case GREATER_THAN:
            return valueAsNumber >= this.filterNumber;
        default:
            // should never happen
            console.log('invalid filter type ' + this.filterType);
            return false;
    }
};

/* public */
NumberFilter.prototype.getGui = function() {
    return this.eGui;
};

/* public */
NumberFilter.prototype.isFilterActive = function() {
    return this.filterNumber !== null;
};

NumberFilter.prototype.createGui = function() {
    this.eGui = utils.loadTemplate(template);
    this.eFilterTextField = this.eGui.querySelector("#filterText");
    this.eTypeSelect = this.eGui.querySelector("#filterType");

    utils.addChangeListener(this.eFilterTextField, this.onFilterChanged.bind(this));
    this.eTypeSelect.addEventListener("change", this.onTypeChanged.bind(this));
};

NumberFilter.prototype.onTypeChanged = function() {
    this.filterType = parseInt(this.eTypeSelect.value);
    this.filterChangedCallback();
};

NumberFilter.prototype.onFilterChanged = function() {
    var filterText = utils.makeNull(this.eFilterTextField.value);
    if (filterText && filterText.trim() === '') {
        filterText = null;
    }
    if (filterText) {
        this.filterNumber = parseFloat(filterText);
    } else {
        this.filterNumber = null;
    }
    this.filterChangedCallback();
};

module.exports = NumberFilter;

},{"./../utils":27,"./numberFilterTemplate.js":7}],7:[function(require,module,exports){
var template = [
    '<div>',
    '<div>',
    '<select class="ag-filter-select" id="filterType">',
    '<option value="1">Equals</option>',
    '<option value="2">Less than</option>',
    '<option value="3">Greater than</option>',
    '</select>',
    '</div>',
    '<div>',
    '<input class="ag-filter-filter" id="filterText" type="text" placeholder="filter..."/>',
    '</div>',
    '</div>',
].join('');

module.exports = template;

},{}],8:[function(require,module,exports){
var utils = require('./../utils');
var SetFilterModel = require('./setFilterModel');
var template = require('./setFilterTemplate');

var DEFAULT_ROW_HEIGHT = 20;

function SetFilter(params) {
    var filterParams = params.filterParams;
    this.rowHeight = (filterParams && filterParams.cellHeight) ? filterParams.cellHeight : DEFAULT_ROW_HEIGHT;
    this.model = new SetFilterModel(params.colDef, params.rowModel);
    this.filterChangedCallback = params.filterChangedCallback;
    this.rowsInBodyContainer = {};
    this.colDef = params.colDef;
    if (filterParams) {
        this.cellRenderer = filterParams.cellRenderer;
    }
    this.createGui();
    this.addScrollListener();
}

// we need to have the gui attached before we can draw the virtual rows, as the
// virtual row logic needs info about the gui state
/* public */
SetFilter.prototype.afterGuiAttached = function() {
    this.drawVirtualRows();
};

/* public */
SetFilter.prototype.isFilterActive = function() {
    return this.model.isFilterActive();
};

/* public */
SetFilter.prototype.doesFilterPass = function(node) {
    var value = node.value;
    var model = node.model;
    //if no filter, always pass
    if (model.isEverythingSelected()) {
        return true;
    }
    //if nothing selected in filter, always fail
    if (model.isNothingSelected()) {
        return false;
    }

    value = utils.makeNull(value);
    var filterPassed = model.selectedValuesMap[value] !== undefined;
    return filterPassed;
};

/* public */
SetFilter.prototype.getGui = function() {
    return this.eGui;
};

/* public */
SetFilter.prototype.onNewRowsLoaded = function() {
    this.model.selectEverything();
    this.updateAllCheckboxes(true);
};

/* public */
SetFilter.prototype.getModel = function() {
    return this.model;
};

SetFilter.prototype.createGui = function() {
    var _this = this;

    this.eGui = utils.loadTemplate(template);

    this.eListContainer = this.eGui.querySelector(".ag-filter-list-container");
    this.eFilterValueTemplate = this.eGui.querySelector("#itemForRepeat");
    this.eSelectAll = this.eGui.querySelector("#selectAll");
    this.eListViewport = this.eGui.querySelector(".ag-filter-list-viewport");
    this.eMiniFilter = this.eGui.querySelector(".ag-filter-filter");
    this.eListContainer.style.height = (this.model.getUniqueValueCount() * this.rowHeight) + "px";

    this.setContainerHeight();
    this.eMiniFilter.value = this.model.getMiniFilter();
    utils.addChangeListener(this.eMiniFilter, function() {
        _this.onFilterChanged();
    });
    utils.removeAllChildren(this.eListContainer);

    this.eSelectAll.onclick = this.onSelectAll.bind(this);

    if (this.model.isEverythingSelected()) {
        this.eSelectAll.indeterminate = false;
        this.eSelectAll.checked = true;
    } else if (this.model.isNothingSelected()) {
        this.eSelectAll.indeterminate = false;
        this.eSelectAll.checked = false;
    } else {
        this.eSelectAll.indeterminate = true;
    }
};

SetFilter.prototype.setContainerHeight = function() {
    this.eListContainer.style.height = (this.model.getDisplayedValueCount() * this.rowHeight) + "px";
};

SetFilter.prototype.drawVirtualRows = function() {
    var topPixel = this.eListViewport.scrollTop;
    var bottomPixel = topPixel + this.eListViewport.offsetHeight;

    var firstRow = Math.floor(topPixel / this.rowHeight);
    var lastRow = Math.floor(bottomPixel / this.rowHeight);

    this.ensureRowsRendered(firstRow, lastRow);
};

SetFilter.prototype.ensureRowsRendered = function(start, finish) {
    var _this = this;

    //at the end, this array will contain the items we need to remove
    var rowsToRemove = Object.keys(this.rowsInBodyContainer);

    //add in new rows
    for (var rowIndex = start; rowIndex <= finish; rowIndex++) {
        //see if item already there, and if yes, take it out of the 'to remove' array
        if (rowsToRemove.indexOf(rowIndex.toString()) >= 0) {
            rowsToRemove.splice(rowsToRemove.indexOf(rowIndex.toString()), 1);
            continue;
        }
        //check this row actually exists (in case overflow buffer window exceeds real data)
        if (this.model.getDisplayedValueCount() > rowIndex) {
            var value = this.model.getDisplayedValue(rowIndex);
            _this.insertRow(value, rowIndex);
        }
    }

    //at this point, everything in our 'rowsToRemove' . . .
    this.removeVirtualRows(rowsToRemove);
};

//takes array of row id's
SetFilter.prototype.removeVirtualRows = function(rowsToRemove) {
    var _this = this;
    rowsToRemove.forEach(function(indexToRemove) {
        var eRowToRemove = _this.rowsInBodyContainer[indexToRemove];
        _this.eListContainer.removeChild(eRowToRemove);
        delete _this.rowsInBodyContainer[indexToRemove];
    });
};

SetFilter.prototype.insertRow = function(value, rowIndex) {
    var _this = this;

    var eFilterValue = this.eFilterValueTemplate.cloneNode(true);

    var valueElement = eFilterValue.querySelector(".ag-filter-value");
    if (this.cellRenderer) {
        //renderer provided, so use it
        var resultFromRenderer = this.cellRenderer({
            value: value
        });

        if (utils.isNode(resultFromRenderer)) {
            //a dom node or element was returned, so add child
            valueElement.appendChild(resultFromRenderer);
        } else {
            //otherwise assume it was html, so just insert
            valueElement.innerHTML = resultFromRenderer;
        }

    } else {
        //otherwise display as a string
        var displayNameOfValue = value === null ? "(Blanks)" : value;
        valueElement.innerHTML = displayNameOfValue;
    }
    var eCheckbox = eFilterValue.querySelector("input");
    eCheckbox.checked = this.model.isValueSelected(value);

    eCheckbox.onclick = function() {
        _this.onCheckboxClicked(eCheckbox, value);
    }

    eFilterValue.style.top = (this.rowHeight * rowIndex) + "px";

    this.eListContainer.appendChild(eFilterValue);
    this.rowsInBodyContainer[rowIndex] = eFilterValue;
};

SetFilter.prototype.onCheckboxClicked = function(eCheckbox, value) {
    var checked = eCheckbox.checked;
    if (checked) {
        this.model.selectValue(value);
        if (this.model.isEverythingSelected()) {
            this.eSelectAll.indeterminate = false;
            this.eSelectAll.checked = true;
        } else {
            this.eSelectAll.indeterminate = true;
        }
    } else {
        this.model.unselectValue(value);
        //if set is empty, nothing is selected
        if (this.model.isNothingSelected()) {
            this.eSelectAll.indeterminate = false;
            this.eSelectAll.checked = false;
        } else {
            this.eSelectAll.indeterminate = true;
        }
    }

    this.filterChangedCallback();
};

SetFilter.prototype.onFilterChanged = function() {
    var miniFilterChanged = this.model.setMiniFilter(this.eMiniFilter.value);
    if (miniFilterChanged) {
        this.setContainerHeight();
        this.clearVirtualRows();
        this.drawVirtualRows();
    }
};

SetFilter.prototype.clearVirtualRows = function() {
    var rowsToRemove = Object.keys(this.rowsInBodyContainer);
    this.removeVirtualRows(rowsToRemove);
};

SetFilter.prototype.onSelectAll = function() {
    var checked = this.eSelectAll.checked;
    if (checked) {
        this.model.selectEverything();
    } else {
        this.model.selectNothing();
    }
    this.updateAllCheckboxes(checked);
    this.filterChangedCallback();
};

SetFilter.prototype.updateAllCheckboxes = function(checked) {
    var currentlyDisplayedCheckboxes = this.eListContainer.querySelectorAll("[filter-checkbox=true]");
    for (var i = 0, l = currentlyDisplayedCheckboxes.length; i < l; i++) {
        currentlyDisplayedCheckboxes[i].checked = checked;
    }
};

SetFilter.prototype.addScrollListener = function() {
    var _this = this;

    this.eListViewport.addEventListener("scroll", function() {
        _this.drawVirtualRows();
    });
};

module.exports = SetFilter;

},{"./../utils":27,"./setFilterModel":9,"./setFilterTemplate":10}],9:[function(require,module,exports){
    var utils = require('../utils');

    function SetFilterModel(colDef, rowModel) {

        if (colDef.filterParams && colDef.filterParams.values) {
            this.uniqueValues = colDef.filterParams.values;
        } else {
            this.createUniqueValues(rowModel, colDef.field);
        }

        if (colDef.comparator) {
            this.uniqueValues.sort(colDef.comparator);
        } else {
            this.uniqueValues.sort(utils.defaultComparator);
        }

        this.displayedValues = this.uniqueValues;
        this.miniFilter = null;
        //we use a map rather than an array for the selected values as the lookup
        //for a map is much faster than the lookup for an array, especially when
        //the length of the array is thousands of records long
        this.selectedValuesMap = {};
        this.selectEverything();
    }

    SetFilterModel.prototype.createUniqueValues = function(rowModel, key) {
        var uniqueCheck = {};
        var result = [];

        function recursivelyProcess(nodes) {
            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (node.group && !node.footer) {
                    // group node, so dig deeper
                    recursivelyProcess(node.children);
                } else {
                    var data = node.data;
                    var value = data ? data[key] : null;
                    if (value === "" || value === undefined) {
                        value = null;
                    }
                    if (!uniqueCheck.hasOwnProperty(value)) {
                        result.push(value);
                        uniqueCheck[value] = 1;
                    }
                }
            }
        }

        var topLevelNodes = rowModel.getTopLevelNodes();
        recursivelyProcess(topLevelNodes);

        this.uniqueValues = result;
    };

    //sets mini filter. returns true if it changed from last value, otherwise false
    SetFilterModel.prototype.setMiniFilter = function(newMiniFilter) {
        newMiniFilter = utils.makeNull(newMiniFilter);
        if (this.miniFilter === newMiniFilter) {
            //do nothing if filter has not changed
            return false;
        }
        this.miniFilter = newMiniFilter;
        this.filterDisplayedValues();
        return true;
    };

    SetFilterModel.prototype.getMiniFilter = function() {
        return this.miniFilter;
    };

    SetFilterModel.prototype.filterDisplayedValues = function() {
        // if no filter, just use the unique values
        if (this.miniFilter === null) {
            this.displayedValues = this.uniqueValues;
            return;
        }

        // if filter present, we filter down the list
        this.displayedValues = [];
        var miniFilterUpperCase = this.miniFilter.toUpperCase();
        for (var i = 0, l = this.uniqueValues.length; i < l; i++) {
            var uniqueValue = this.uniqueValues[i];
            if (uniqueValue !== null && uniqueValue.toString().toUpperCase().indexOf(miniFilterUpperCase) >= 0) {
                this.displayedValues.push(uniqueValue);
            }
        }

    };

    SetFilterModel.prototype.getDisplayedValueCount = function() {
        return this.displayedValues.length;
    };

    SetFilterModel.prototype.getDisplayedValue = function(index) {
        return this.displayedValues[index];
    };

    SetFilterModel.prototype.selectEverything = function() {
        var count = this.uniqueValues.length;
        for (var i = 0; i < count; i++) {
            var value = this.uniqueValues[i];
            this.selectedValuesMap[value] = null;
        }
        this.selectedValuesCount = count;
    };

    SetFilterModel.prototype.isFilterActive = function() {
        return this.uniqueValues.length !== this.selectedValuesCount;
    };

    SetFilterModel.prototype.selectNothing = function() {
        this.selectedValuesMap = {};
        this.selectedValuesCount = 0;
    };

    SetFilterModel.prototype.getUniqueValueCount = function() {
        return this.uniqueValues.length;
    };

    SetFilterModel.prototype.unselectValue = function(value) {
        if (this.selectedValuesMap[value] !== undefined) {
            delete this.selectedValuesMap[value];
            this.selectedValuesCount--;
        }
    };

    SetFilterModel.prototype.selectValue = function(value) {
        if (this.selectedValuesMap[value] === undefined) {
            this.selectedValuesMap[value] = null;
            this.selectedValuesCount++;
        }
    };

    SetFilterModel.prototype.isValueSelected = function(value) {
        return this.selectedValuesMap[value] !== undefined;
    };

    SetFilterModel.prototype.isEverythingSelected = function() {
        return this.uniqueValues.length === this.selectedValuesCount;
    };

    SetFilterModel.prototype.isNothingSelected = function() {
        return this.uniqueValues.length === 0;
    };

    module.exports = SetFilterModel;

},{"../utils":27}],10:[function(require,module,exports){
var template = [
    '<div>',
    '    <div class="ag-filter-header-container">',
    '        <input class="ag-filter-filter" type="text" placeholder="search..."/>',
    '    </div>',
    '    <div class="ag-filter-header-container">',
    '        <label>',
    '            <input id="selectAll" type="checkbox" class="ag-filter-checkbox"/>',
    '            (Select All)',
    '        </label>',
    '    </div>',
    '    <div class="ag-filter-list-viewport">',
    '        <div class="ag-filter-list-container">',
    '            <div id="itemForRepeat" class="ag-filter-item">',
    '                <label>',
    '                    <input type="checkbox" class="ag-filter-checkbox" filter-checkbox="true"/>',
    '                    <span class="ag-filter-value"></span>',
    '                </label>',
    '            </div>',
    '        </div>',
    '    </div>',
    '</div>',
].join('');

module.exports = template;

},{}],11:[function(require,module,exports){
var utils = require('../utils');
var template = require('./textFilterTemplate');

var CONTAINS = 1;
var EQUALS = 2;
var STARTS_WITH = 3;
var ENDS_WITH = 4;

function TextFilter(params) {
    this.filterChangedCallback = params.filterChangedCallback;
    this.createGui();
    this.filterText = null;
    this.filterType = CONTAINS;
}

/* public */
TextFilter.prototype.afterGuiAttached = function() {
    this.eFilterTextField.focus();
};

/* public */
TextFilter.prototype.doesFilterPass = function(node) {
    if (!this.filterText) {
        return true;
    }
    var value = node.value;
    if (!value) {
        return false;
    }
    var valueLowerCase = value.toString().toLowerCase();
    switch (this.filterType) {
        case CONTAINS:
            return valueLowerCase.indexOf(this.filterText) >= 0;
        case EQUALS:
            return valueLowerCase === this.filterText;
        case STARTS_WITH:
            return valueLowerCase.indexOf(this.filterText) === 0;
        case ENDS_WITH:
            var index = valueLowerCase.indexOf(this.filterText);
            return index >= 0 && index === (valueLowerCase.length - this.filterText.length);
        default:
            // should never happen
            console.log('invalid filter type ' + this.filterType);
            return false;
    }
};

/* public */
TextFilter.prototype.getGui = function() {
    return this.eGui;
};

/* public */
TextFilter.prototype.isFilterActive = function() {
    return this.filterText !== null;
};

TextFilter.prototype.createGui = function() {
    this.eGui = utils.loadTemplate(template);
    this.eFilterTextField = this.eGui.querySelector("#filterText");
    this.eTypeSelect = this.eGui.querySelector("#filterType");

    utils.addChangeListener(this.eFilterTextField, this.onFilterChanged.bind(this));
    this.eTypeSelect.addEventListener("change", this.onTypeChanged.bind(this));
};

TextFilter.prototype.onTypeChanged = function() {
    this.filterType = parseInt(this.eTypeSelect.value);
    this.filterChangedCallback();
};

TextFilter.prototype.onFilterChanged = function() {
    var filterText = utils.makeNull(this.eFilterTextField.value);
    if (filterText && filterText.trim() === '') {
        filterText = null;
    }
    if (filterText) {
        this.filterText = filterText.toLowerCase();
    } else {
        this.filterText = null;
    }
    this.filterChangedCallback();
};

module.exports = TextFilter;

},{"../utils":27,"./textFilterTemplate":12}],12:[function(require,module,exports){
var template = [
    '<div>',
    '<div>',
    '<select class="ag-filter-select" id="filterType">',
    '<option value="1">Contains</option>',
    '<option value="2">Equals</option>',
    '<option value="3">Starts with</option>',
    '<option value="4">Ends with</option>',
    '</select>',
    '</div>',
    '<div>',
    '<input class="ag-filter-filter" id="filterText" type="text" placeholder="filter..."/>',
    '</div>',
    '</div>',
].join('');

module.exports = template;

},{}],13:[function(require,module,exports){
var utils = require('./utils');
var constants = require('./constants');
var GridOptionsWrapper = require('./gridOptionsWrapper');
var template = require('./template.js');
var templateNoScrolls = require('./templateNoScrolls.js');
var SelectionController = require('./selectionController');
var FilterManager = require('./filter/filterManager');
var SelectionRendererFactory = require('./selectionRendererFactory');
var ColumnController = require('./columnController');
var RowRenderer = require('./rowRenderer');
var HeaderRenderer = require('./headerRenderer');
var InMemoryRowController = require('./inMemoryRowController');
var VirtualPageRowController = require('./virtualPageRowController');
var PaginationController = require('./paginationController');
var ExpressionService = require('./expressionService');
var TemplateService = require('./templateService');

function Grid(eGridDiv, gridOptions, $scope, $compile) {

    this.gridOptions = gridOptions;
    this.gridOptionsWrapper = new GridOptionsWrapper(this.gridOptions);

    var useScrolls = !this.gridOptionsWrapper.isDontUseScrolls();
    if (useScrolls) {
        eGridDiv.innerHTML = template;
    } else {
        eGridDiv.innerHTML = templateNoScrolls;
    }

    var that = this;
    this.quickFilter = null;

    // if using angular, watch for quickFilter changes
    if ($scope) {
        $scope.$watch("angularGrid.quickFilterText", function(newFilter) {
            that.onQuickFilterChanged(newFilter);
        });
    }

    this.virtualRowCallbacks = {};

    this.addApi();
    this.findAllElements(eGridDiv);
    this.createAndWireBeans($scope, $compile, eGridDiv, useScrolls);

    this.scrollWidth = utils.getScrollbarWidth();

    this.inMemoryRowController.setAllRows(this.gridOptionsWrapper.getAllRows());

    if (useScrolls) {
        this.addScrollListener();
        this.setBodySize(); //setting sizes of body (containing viewports), doesn't change container sizes
    }

    // done when cols change
    this.setupColumns();

    // done when rows change
    this.updateModelAndRefresh(constants.STEP_EVERYTHING);

    // flag to mark when the directive is destroyed
    this.finished = false;

    // if no data provided initially, and not doing infinite scrolling, show the loading panel
    var showLoading = !this.gridOptionsWrapper.getAllRows() && !this.gridOptionsWrapper.isVirtualPaging();
    this.showLoadingPanel(showLoading);

    // if datasource provided, use it
    if (this.gridOptionsWrapper.getDatasource()) {
        this.setDatasource();
    }

    // if ready function provided, use it
    if (typeof this.gridOptionsWrapper.getReady() == 'function') {
        this.gridOptionsWrapper.getReady()(gridOptions.api);
    }
}

Grid.prototype.createAndWireBeans = function($scope, $compile, eGridDiv, useScrolls) {

    // make local references, to make the below more human readable
    var gridOptionsWrapper = this.gridOptionsWrapper;
    var gridOptions = this.gridOptions;

    // create all the beans
    var selectionController = new SelectionController();
    var filterManager = new FilterManager();
    var selectionRendererFactory = new SelectionRendererFactory();
    var columnController = new ColumnController();
    var rowRenderer = new RowRenderer();
    var headerRenderer = new HeaderRenderer();
    var inMemoryRowController = new InMemoryRowController();
    var virtualPageRowController = new VirtualPageRowController();
    var expressionService = new ExpressionService();
    var templateService = new TemplateService();

    var columnModel = columnController.getModel();

    // initialise all the beans
    templateService.init($scope);
    selectionController.init(this, this.eParentOfRows, gridOptionsWrapper, $scope, rowRenderer);
    filterManager.init(this, gridOptionsWrapper, $compile, $scope);
    selectionRendererFactory.init(this, selectionController);
    columnController.init(this, selectionRendererFactory, gridOptionsWrapper);
    rowRenderer.init(gridOptions, columnModel, gridOptionsWrapper, eGridDiv, this,
        selectionRendererFactory, $compile, $scope, selectionController, expressionService, templateService,
        this.eParentOfRows);
    headerRenderer.init(gridOptionsWrapper, columnController, columnModel, eGridDiv, this, filterManager, $scope, $compile);
    inMemoryRowController.init(gridOptionsWrapper, columnModel, this, filterManager, $scope, expressionService);
    virtualPageRowController.init(rowRenderer);

    // this is a child bean, get a reference and pass it on
    // CAN WE DELETE THIS? it's done in the setDatasource section
    var rowModel = inMemoryRowController.getModel();
    selectionController.setRowModel(rowModel);
    filterManager.setRowModel(rowModel);
    rowRenderer.setRowModel(rowModel);

    // and the last bean, done in it's own section, as it's optional
    var paginationController = null;
    if (useScrolls) {
        paginationController = new PaginationController();
        paginationController.init(this.ePagingPanel, this);
    }

    this.rowModel = rowModel;
    this.selectionController = selectionController;
    this.columnController = columnController;
    this.columnModel = columnModel;
    this.inMemoryRowController = inMemoryRowController;
    this.virtualPageRowController = virtualPageRowController;
    this.rowRenderer = rowRenderer;
    this.headerRenderer = headerRenderer;
    this.paginationController = paginationController;
    this.filterManager = filterManager;
};

Grid.prototype.showAndPositionPagingPanel = function() {
    // no paging when no-scrolls
    if (!this.ePagingPanel) {
        return;
    }

    if (this.isShowPagingPanel()) {
        this.ePagingPanel.style['display'] = null;
        var heightOfPager = this.ePagingPanel.offsetHeight;
        this.eBody.style['padding-bottom'] = heightOfPager + 'px';
        var heightOfRoot = this.eRoot.clientHeight;
        var topOfPager = heightOfRoot - heightOfPager;
        this.ePagingPanel.style['top'] = topOfPager + 'px';
    } else {
        this.ePagingPanel.style['display'] = 'none';
        this.eBody.style['padding-bottom'] = null;
    }

};

Grid.prototype.isShowPagingPanel = function() {
    return this.showPagingPanel;
};

Grid.prototype.setDatasource = function(datasource) {
    // if datasource provided, then set it
    if (datasource) {
        this.gridOptions.datasource = datasource;
    }
    // get the set datasource (if null was passed to this method,
    // then need to get the actual datasource from options
    var datasourceToUse = this.gridOptionsWrapper.getDatasource();
    var virtualPaging = this.gridOptionsWrapper.isVirtualPaging() && datasourceToUse;
    var pagination = datasourceToUse && !virtualPaging;

    if (virtualPaging) {
        this.paginationController.setDatasource(null);
        this.virtualPageRowController.setDatasource(datasourceToUse);
        this.rowModel = this.virtualPageRowController.getModel();
        this.showPagingPanel = false;
    } else if (pagination) {
        this.paginationController.setDatasource(datasourceToUse);
        this.virtualPageRowController.setDatasource(null);
        this.rowModel = this.inMemoryRowController.getModel();
        this.showPagingPanel = true;
    } else {
        this.paginationController.setDatasource(null);
        this.virtualPageRowController.setDatasource(null);
        this.rowModel = this.inMemoryRowController.getModel();
        this.showPagingPanel = false;
    }

    this.selectionController.setRowModel(this.rowModel);
    this.filterManager.setRowModel(this.rowModel);
    this.rowRenderer.setRowModel(this.rowModel);

    // we may of just shown or hidden the paging panel, so need
    // to get table to check the body size, which also hides and
    // shows the paging panel.
    this.setBodySize();

    // because we just set the rowModel, need to update the gui
    this.rowRenderer.refreshView();
};

// gets called after columns are shown / hidden from groups expanding
Grid.prototype.refreshHeaderAndBody = function() {
    this.headerRenderer.refreshHeader();
    this.headerRenderer.updateFilterIcons();
    this.setBodyContainerWidth();
    this.setPinnedColContainerWidth();
    this.rowRenderer.refreshView();
};

Grid.prototype.setFinished = function() {
    this.finished = true;
};

Grid.prototype.getPopupParent = function() {
    return this.eRoot;
};

Grid.prototype.getQuickFilter = function() {
    return this.quickFilter;
};

Grid.prototype.onQuickFilterChanged = function(newFilter) {
    if (newFilter === undefined || newFilter === "") {
        newFilter = null;
    }
    if (this.quickFilter !== newFilter) {
        //want 'null' to mean to filter, so remove undefined and empty string
        if (newFilter === undefined || newFilter === "") {
            newFilter = null;
        }
        if (newFilter !== null) {
            newFilter = newFilter.toUpperCase();
        }
        this.quickFilter = newFilter;
        this.onFilterChanged();
    }
};

Grid.prototype.onFilterChanged = function() {
    this.updateModelAndRefresh(constants.STEP_FILTER);
    this.headerRenderer.updateFilterIcons();
};

Grid.prototype.onRowClicked = function(event, rowIndex, node) {

    if (this.gridOptions.rowClicked) {
        var params = {
            node: node,
            data: node.data,
            event: event
        };
        this.gridOptions.rowClicked(params);
    }

    // we do not allow selecting groups by clicking (as the click here expands the group)
    // so return if it's a group row
    if (node.group) {
        return;
    }

    // if no selection method enabled, do nothing
    if (!this.gridOptionsWrapper.isRowSelection()) {
        return;
    }

    // if click selection suppressed, do nothing
    if (this.gridOptionsWrapper.isSuppressRowClickSelection()) {
        return;
    }

    // ctrlKey for windows, metaKey for Apple
    var tryMulti = event.ctrlKey || event.metaKey;
    this.selectionController.selectNode(node, tryMulti);
};

Grid.prototype.setHeaderHeight = function() {
    var headerHeight = this.gridOptionsWrapper.getHeaderHeight();
    var headerHeightPixels = headerHeight + 'px';
    var dontUseScrolls = this.gridOptionsWrapper.isDontUseScrolls();
    if (dontUseScrolls) {
        this.eHeaderContainer.style['height'] = headerHeightPixels;
    } else {
        this.eHeader.style['height'] = headerHeightPixels;
        this.eBody.style['padding-top'] = headerHeightPixels;
        this.eLoadingPanel.style['margin-top'] = headerHeightPixels;
    }
};

Grid.prototype.showLoadingPanel = function(show) {
    if (show) {
        // setting display to null, actually has the impact of setting it
        // to 'table', as this is part of the ag-loading-panel core style
        this.eLoadingPanel.style.display = null;
    } else {
        this.eLoadingPanel.style.display = 'none';
    }
};

Grid.prototype.setupColumns = function() {
    this.setHeaderHeight();
    this.columnController.setColumns(this.gridOptionsWrapper.getColumnDefs());
    this.showPinnedColContainersIfNeeded();
    this.headerRenderer.refreshHeader();
    if (!this.gridOptionsWrapper.isDontUseScrolls()) {
        this.setPinnedColContainerWidth();
        this.setBodyContainerWidth();
    }
    this.headerRenderer.updateFilterIcons();
};

Grid.prototype.setBodyContainerWidth = function() {
    var mainRowWidth = this.columnModel.getBodyContainerWidth() + "px";
    this.eBodyContainer.style.width = mainRowWidth;
};

Grid.prototype.updateModelAndRefresh = function(step) {
    this.inMemoryRowController.updateModel(step);
    this.rowRenderer.refreshView();
};

Grid.prototype.setRows = function(rows, firstId) {
    if (rows) {
        this.gridOptions.rowData = rows;
    }
    this.inMemoryRowController.setAllRows(this.gridOptionsWrapper.getAllRows(), firstId);
    this.selectionController.deselectAll();
    this.filterManager.onNewRowsLoaded();
    this.updateModelAndRefresh(constants.STEP_EVERYTHING);
    this.headerRenderer.updateFilterIcons();
    this.showLoadingPanel(false);
};

Grid.prototype.ensureNodeVisible = function(comparator) {
    // look for the node index we want to display
    var rowCount = this.rowModel.getVirtualRowCount();
    var comparatorIsAFunction = typeof comparator === 'function';
    var indexToSelect = -1;
    // go through all the nodes, find the one we want to show
    for (var i = 0; i < rowCount; i++) {
        var node = this.rowModel.getVirtualRow(i);
        if (comparatorIsAFunction) {
            if (comparator(node)) {
                indexToSelect = i;
                break;
            }
        } else {
            // check object equality against node and data
            if (comparator === node || comparator === node.data) {
                indexToSelect = i;
                break;
            }
        }
    }
    if (indexToSelect >= 0) {
        this.ensureIndexVisible(indexToSelect);
    }
};

Grid.prototype.ensureIndexVisible = function(index) {
    var lastRow = this.rowModel.getVirtualRowCount();
    if (typeof index !== 'number' || index < 0 || index >= lastRow) {
        throw 'invalid row index for ensureIndexVisible: ' + index;
    }

    var rowHeight = this.gridOptionsWrapper.getRowHeight();
    var rowTopPixel = rowHeight * index;
    var rowBottomPixel = rowTopPixel + rowHeight;

    var viewportTopPixel = this.eBodyViewport.scrollTop;
    var viewportHeight = this.eBodyViewport.offsetHeight;
    var scrollShowing = this.eBodyViewport.clientWidth < this.eBodyViewport.scrollWidth;
    if (scrollShowing) {
        viewportHeight -= this.scrollWidth;
    }
    var viewportBottomPixel = viewportTopPixel + viewportHeight;

    var viewportScrolledPastRow = viewportTopPixel > rowTopPixel;
    var viewportScrolledBeforeRow = viewportBottomPixel < rowBottomPixel;

    if (viewportScrolledPastRow) {
        // if row is before, scroll up with row at top
        this.eBodyViewport.scrollTop = rowTopPixel;
    } else if (viewportScrolledBeforeRow) {
        // if row is below, scroll down with row at bottom
        var newScrollPosition = rowBottomPixel - viewportHeight;
        this.eBodyViewport.scrollTop = newScrollPosition;
    }
    // otherwise, row is already in view, so do nothing
};

Grid.prototype.addApi = function() {
    var that = this;
    var api = {
        setDatasource: function(datasource) {
            that.setDatasource(datasource);
        },
        onNewDatasource: function() {
            that.setDatasource();
        },
        setRows: function(rows) {
            that.setRows(rows);
        },
        onNewRows: function() {
            that.setRows();
        },
        onNewCols: function() {
            that.onNewCols();
        },
        unselectAll: function() {
            console.error("unselectAll deprecated, call deselectAll instead");
            this.deselectAll();
        },
        refreshView: function() {
            that.rowRenderer.refreshView();
        },
        softRefreshView: function() {
            that.rowRenderer.softRefreshView();
        },
        refreshGroupRows: function() {
            that.rowRenderer.refreshGroupRows();
        },
        refreshHeader: function() {
            // need to review this - the refreshHeader should also refresh all icons in the header
            that.headerRenderer.refreshHeader();
            that.headerRenderer.updateFilterIcons();
        },
        getModel: function() {
            return that.rowModel;
        },
        onGroupExpandedOrCollapsed: function() {
            that.updateModelAndRefresh(constants.STEP_MAP);
        },
        expandAll: function() {
            that.inMemoryRowController.expandOrCollapseAll(true, null);
            that.updateModelAndRefresh(constants.STEP_MAP);
        },
        collapseAll: function() {
            that.inMemoryRowController.expandOrCollapseAll(false, null);
            that.updateModelAndRefresh(constants.STEP_MAP);
        },
        addVirtualRowListener: function(rowIndex, callback) {
            that.addVirtualRowListener(rowIndex, callback);
        },
        rowDataChanged: function(rows) {
            that.rowRenderer.rowDataChanged(rows);
        },
        setQuickFilter: function(newFilter) {
            that.onQuickFilterChanged(newFilter)
        },
        selectIndex: function(index, tryMulti, suppressEvents) {
            that.selectionController.selectIndex(index, tryMulti, suppressEvents);
        },
        deselectIndex: function(index) {
            that.selectionController.deselectIndex(index);
        },
        selectNode: function(node, tryMulti, suppressEvents) {
            that.selectionController.selectNode(node, tryMulti, suppressEvents);
        },
        deselectNode: function(node) {
            that.selectionController.deselectNode(node);
        },
        selectAll: function() {
            that.selectionController.selectAll();
            that.rowRenderer.refreshView();
        },
        deselectAll: function() {
            that.selectionController.deselectAll();
            that.rowRenderer.refreshView();
        },
        recomputeAggregates: function() {
            that.inMemoryRowController.doAggregate();
            that.rowRenderer.refreshGroupRows();
        },
        sizeColumnsToFit: function() {
            var availableWidth = that.eBody.clientWidth;
            var scrollShowing = that.eBodyViewport.clientHeight < that.eBodyViewport.scrollHeight;
            if (scrollShowing) {
                availableWidth -= that.scrollWidth;
            }
            that.columnController.sizeColumnsToFit(availableWidth);
        },
        showLoading: function(show) {
            that.showLoadingPanel(show);
        },
        isNodeSelected: function(node) {
            return that.selectionController.isNodeSelected(node);
        },
        getSelectedNodes: function() {
            return that.selectionController.getSelectedNodes();
        },
        getBestCostNodeSelection: function() {
            return that.selectionController.getBestCostNodeSelection();
        },
        ensureIndexVisible: function(index) {
            return that.ensureIndexVisible(index);
        },
        ensureNodeVisible: function(comparator) {
            return that.ensureNodeVisible(comparator);
        },
        exportDataAsCsv: function (params) {
          return that.exportDataAsCsv(params);
        }
    };
    this.gridOptions.api = api;
};

Grid.prototype.exportDataAsCsv = function (params) {
  var csvString = this.getDataAsCsv(params);
  var fileNamePresent = params && params.fileName && params.fileName.length !== 0;
  var fileName = fileNamePresent ? params.fileName : 'export.csv';
  var blobObject = new Blob([csvString], {
    type: 'text/csv;charset=utf-8;'
  });
  // Internet Explorer
  if (window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveOrOpenBlob(blobObject, fileName);
  } else {
    // Chrome
    var downloadLink = document.createElement("a");
    downloadLink.href = (window).URL.createObjectURL(blobObject);
    downloadLink.download = fileName;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
}
Grid.prototype.getDataAsCsv = function (params) {

  var LINE_SEPARATOR = '\r\n';

  var result = '';

  var skipGroups = params && params.skipGroups;
  var skipHeader = params && params.skipHeader;
  var skipFooters = params && params.skipFooters;
  var includeCustomHeader = params && params.customHeader;
  var includeCustomFooter = params && params.customFooter;

  var columnsToExport = this.gridOptions.columnDefs;

  if (!columnsToExport || columnsToExport.length === 0) {
    return '';
  }

  if (includeCustomHeader) {
    result += params.customHeader;
  }

  // first pass, put in the header names of the cols
  if (!skipHeader) {
    columnsToExport.forEach(function(column, index) {
      console.log(column);
      var nameForCol = column.group ? column.group + ':' : '';
      nameForCol += column.displayName;
      if (nameForCol === null || nameForCol === undefined) {
        nameForCol = '';
      }
      if (index != 0) {
        result += ';';
      }
      result += '"' + this.escape(nameForCol) + '"';
    });
    result += LINE_SEPARATOR;
  }

  this.inMemoryRowController.rowsAfterSort.forEach(function(node) {
    if (skipGroups && node.group) { return; }
    if (skipFooters && node.footer) { return; }

    columnsToExport.forEach(function(column, index)  {

      var valueForCell;
      var data = node.data[column.field];
      if (node.group && index === 0) {
        valueForCell = this.createValueForGroupNode(node);
      } else if (data) {
        //console.log(column);
        if (column.exportRenderer) {
          var data = node.data[column.field];
          if (Array.isArray(data)) {
            console.log('is array');
            valueForCell = column.exportRenderer(data);
          }
          else {
            console.log('no array' + node.data + 'column' + column);
            valueForCell = column.exportRenderer(data);
          }
          console.log('value: ' + valueForCell);
        }
        else {
          valueForCell = node.data ? node.data[column.field] : null;
        }
      }
      if (valueForCell === null || valueForCell === undefined) {
        valueForCell = '';
      }
      if (index != 0) {
        result += ';';
      }
      result += '"' + this.escape(valueForCell) + '"';
    });

    result += LINE_SEPARATOR;
  });

  if (includeCustomFooter) {
    result += params.customFooter;
  }

  return result;
};

Grid.prototype.createValueForGroupNode = function (node) {
  var keys = [node.key];
  while (node.parent) {
    node = node.parent;
    keys.push(node.key);
  }
  return keys.reverse().join(' -> ');
};

// replace each " with "" (ie two sets of double quotes is how to do double quotes in csv)
Grid.prototype.escape = function (value) {
  if (value === null || value === undefined) {
    return '';
  }

  var stringValue;
  if (typeof value === 'string') {
    stringValue = value;
  } else if (typeof value.toString === 'function') {
    stringValue = value.toString();
  } else {
    console.warn('known value type during csv conversion');
    stringValue = '';
  }

  return stringValue.replace(/"/g, "\"\"");
};

Grid.prototype.addVirtualRowListener = function(rowIndex, callback) {
    if (!this.virtualRowCallbacks[rowIndex]) {
        this.virtualRowCallbacks[rowIndex] = [];
    }
    this.virtualRowCallbacks[rowIndex].push(callback);
};

Grid.prototype.onVirtualRowSelected = function(rowIndex, selected) {
    // inform the callbacks of the event
    if (this.virtualRowCallbacks[rowIndex]) {
        this.virtualRowCallbacks[rowIndex].forEach(function(callback) {
            if (typeof callback.rowRemoved === 'function') {
                callback.rowSelected(selected);
            }
        });
    }
};

Grid.prototype.onVirtualRowRemoved = function(rowIndex) {
    // inform the callbacks of the event
    if (this.virtualRowCallbacks[rowIndex]) {
        this.virtualRowCallbacks[rowIndex].forEach(function(callback) {
            if (typeof callback.rowRemoved === 'function') {
                callback.rowRemoved();
            }
        });
    }
    // remove the callbacks
    delete this.virtualRowCallbacks[rowIndex];
};

Grid.prototype.onNewCols = function() {
    this.setupColumns();
    this.updateModelAndRefresh(constants.STEP_EVERYTHING);
};

Grid.prototype.findAllElements = function(eGridDiv) {
    if (this.gridOptionsWrapper.isDontUseScrolls()) {
        this.eRoot = eGridDiv.querySelector(".ag-root");
        this.eHeaderContainer = eGridDiv.querySelector(".ag-header-container");
        this.eBodyContainer = eGridDiv.querySelector(".ag-body-container");
        this.eLoadingPanel = eGridDiv.querySelector('.ag-loading-panel');
        // for no-scrolls, all rows live in the body container
        this.eParentOfRows = this.eBodyContainer;
    } else {
        this.eRoot = eGridDiv.querySelector(".ag-root");
        this.eBody = eGridDiv.querySelector(".ag-body");
        this.eBodyContainer = eGridDiv.querySelector(".ag-body-container");
        this.eBodyViewport = eGridDiv.querySelector(".ag-body-viewport");
        this.eBodyViewportWrapper = eGridDiv.querySelector(".ag-body-viewport-wrapper");
        this.ePinnedColsContainer = eGridDiv.querySelector(".ag-pinned-cols-container");
        this.ePinnedColsViewport = eGridDiv.querySelector(".ag-pinned-cols-viewport");
        this.ePinnedHeader = eGridDiv.querySelector(".ag-pinned-header");
        this.eHeader = eGridDiv.querySelector(".ag-header");
        this.eHeaderContainer = eGridDiv.querySelector(".ag-header-container");
        this.eLoadingPanel = eGridDiv.querySelector('.ag-loading-panel');
        // for scrolls, all rows live in eBody (containing pinned and normal body)
        this.eParentOfRows = this.eBody;
        this.ePagingPanel = eGridDiv.querySelector('.ag-paging-panel');
    }
};

Grid.prototype.showPinnedColContainersIfNeeded = function() {
    // no need to do this if not using scrolls
    if (this.gridOptionsWrapper.isDontUseScrolls()) {
        return;
    }

    var showingPinnedCols = this.gridOptionsWrapper.getPinnedColCount() > 0;

    //some browsers had layout issues with the blank divs, so if blank,
    //we don't display them
    if (showingPinnedCols) {
        this.ePinnedHeader.style.display = 'inline-block';
        this.ePinnedColsViewport.style.display = 'inline';
    } else {
        this.ePinnedHeader.style.display = 'none';
        this.ePinnedColsViewport.style.display = 'none';
    }
};

Grid.prototype.updateBodyContainerWidthAfterColResize = function() {
    this.rowRenderer.setMainRowWidths();
    this.setBodyContainerWidth();
};

Grid.prototype.updatePinnedColContainerWidthAfterColResize = function() {
    this.setPinnedColContainerWidth();
};

Grid.prototype.setPinnedColContainerWidth = function() {
    var pinnedColWidth = this.columnModel.getPinnedContainerWidth() + "px";
    this.ePinnedColsContainer.style.width = pinnedColWidth;
    this.eBodyViewportWrapper.style.marginLeft = pinnedColWidth;
};

// see if a grey box is needed at the bottom of the pinned col
Grid.prototype.setPinnedColHeight = function() {
    // var bodyHeight = utils.pixelStringToNumber(this.eBody.style.height);
    var scrollShowing = this.eBodyViewport.clientWidth < this.eBodyViewport.scrollWidth;
    var bodyHeight = this.eBodyViewport.offsetHeight;
    if (scrollShowing) {
        this.ePinnedColsViewport.style.height = (bodyHeight - this.scrollWidth) + "px";
    } else {
        this.ePinnedColsViewport.style.height = bodyHeight + "px";
    }
    // also the loading overlay, needs to have it's height adjusted
    this.eLoadingPanel.style.height = bodyHeight + 'px';
};

Grid.prototype.setBodySize = function() {
    var _this = this;

    var bodyHeight = this.eBodyViewport.offsetHeight;
    var pagingVisible = this.isShowPagingPanel();

    if (this.bodyHeightLastTime != bodyHeight || this.showPagingPanelVisibleLastTime != pagingVisible) {
        this.bodyHeightLastTime = bodyHeight;
        this.showPagingPanelVisibleLastTime = pagingVisible;

        this.setPinnedColHeight();

        //only draw virtual rows if done sort & filter - this
        //means we don't draw rows if table is not yet initialised
        if (this.rowModel.getVirtualRowCount() > 0) {
            this.rowRenderer.drawVirtualRows();
        }

        // show and position paging panel
        this.showAndPositionPagingPanel();
    }

    if (!this.finished) {
        setTimeout(function() {
            _this.setBodySize();
        }, 200);
    }
};

Grid.prototype.addScrollListener = function() {
    var that = this;

    var lastLeftPosition = -1;
    var lastTopPosition = -1;

    this.eBodyViewport.addEventListener("scroll", function() {
        var newLeftPosition = that.eBodyViewport.scrollLeft;
        var newTopPosition = that.eBodyViewport.scrollTop;

        if (newLeftPosition !== lastLeftPosition) {
            lastLeftPosition = newLeftPosition;
            that.scrollHeader(newLeftPosition);
        }

        if (newTopPosition !== lastTopPosition) {
            lastTopPosition = newTopPosition;
            that.scrollPinned(newTopPosition);
            that.rowRenderer.drawVirtualRows();
        }
    });

    this.ePinnedColsViewport.addEventListener("scroll", function() {
        // this means the pinned panel was moved, which can only
        // happen when the user is navigating in the pinned container
        // as the pinned col should never scroll. so we rollback
        // the scroll on the pinned.
        that.ePinnedColsViewport.scrollTop = 0;
    });

};

Grid.prototype.scrollHeader = function(bodyLeftPosition) {
    // this.eHeaderContainer.style.transform = 'translate3d(' + -bodyLeftPosition + "px,0,0)";
    this.eHeaderContainer.style.left = -bodyLeftPosition + "px";
};

Grid.prototype.scrollPinned = function(bodyTopPosition) {
    // this.ePinnedColsContainer.style.transform = 'translate3d(0,' + -bodyTopPosition + "px,0)";
    this.ePinnedColsContainer.style.top = -bodyTopPosition + "px";
};

module.exports = Grid;

},{"./columnController":2,"./constants":3,"./expressionService":4,"./filter/filterManager":5,"./gridOptionsWrapper":14,"./headerRenderer":16,"./inMemoryRowController":17,"./paginationController":19,"./rowRenderer":20,"./selectionController":21,"./selectionRendererFactory":22,"./template.js":24,"./templateNoScrolls.js":25,"./templateService":26,"./utils":27,"./virtualPageRowController":28}],14:[function(require,module,exports){
var DEFAULT_ROW_HEIGHT = 30;

function GridOptionsWrapper(gridOptions) {
    this.gridOptions = gridOptions;
    this.setupDefaults();
}

function isTrue(value) {
    return value === true || value === 'true';
}

GridOptionsWrapper.prototype.isRowSelection = function() { return this.gridOptions.rowSelection === "single" || this.gridOptions.rowSelection === "multiple"; };
GridOptionsWrapper.prototype.isRowSelectionMulti = function() { return this.gridOptions.rowSelection === 'multiple'; };
GridOptionsWrapper.prototype.getContext = function() { return this.gridOptions.context; };
GridOptionsWrapper.prototype.isVirtualPaging = function() { return isTrue(this.gridOptions.virtualPaging); };
GridOptionsWrapper.prototype.isRowsAlreadyGrouped = function() { return isTrue(this.gridOptions.rowsAlreadyGrouped); };
GridOptionsWrapper.prototype.isGroupSelectsChildren = function() { return isTrue(this.gridOptions.groupSelectsChildren); };
GridOptionsWrapper.prototype.isGroupIncludeFooter = function() { return isTrue(this.gridOptions.groupIncludeFooter); };
GridOptionsWrapper.prototype.isSuppressRowClickSelection = function() { return isTrue(this.gridOptions.suppressRowClickSelection); };
GridOptionsWrapper.prototype.isGroupHeaders = function() { return isTrue(this.gridOptions.groupHeaders); };
GridOptionsWrapper.prototype.getGroupInnerRenderer = function() { return this.gridOptions.groupInnerRenderer; };
GridOptionsWrapper.prototype.isDontUseScrolls = function() { return isTrue(this.gridOptions.dontUseScrolls); };
GridOptionsWrapper.prototype.getRowStyle = function() { return this.gridOptions.rowStyle; };
GridOptionsWrapper.prototype.getRowClass = function() { return this.gridOptions.rowClass; };
GridOptionsWrapper.prototype.getGridOptions = function() { return this.gridOptions; };
GridOptionsWrapper.prototype.getHeaderCellRenderer = function() { return this.gridOptions.headerCellRenderer; };
GridOptionsWrapper.prototype.getApi = function() { return this.gridOptions.api; };
GridOptionsWrapper.prototype.isEnableSorting = function() { return this.gridOptions.enableSorting; };
GridOptionsWrapper.prototype.isEnableColResize = function() { return this.gridOptions.enableColResize; };
GridOptionsWrapper.prototype.isEnableFilter = function() { return this.gridOptions.enableFilter; };
GridOptionsWrapper.prototype.getColWidth = function() { return this.gridOptions.colWidth; };
GridOptionsWrapper.prototype.getGroupDefaultExpanded = function() { return this.gridOptions.groupDefaultExpanded; };
GridOptionsWrapper.prototype.getGroupKeys = function() { return this.gridOptions.groupKeys; };
GridOptionsWrapper.prototype.getGroupAggFunction = function() { return this.gridOptions.groupAggFunction; };
GridOptionsWrapper.prototype.getAllRows = function() { return this.gridOptions.rowData; };
GridOptionsWrapper.prototype.isGroupUseEntireRow = function() { return isTrue(this.gridOptions.groupUseEntireRow); };
GridOptionsWrapper.prototype.isAngularCompileRows = function() { return isTrue(this.gridOptions.angularCompileRows); };
GridOptionsWrapper.prototype.isAngularCompileFilters = function() { return isTrue(this.gridOptions.angularCompileFilters); };
GridOptionsWrapper.prototype.isAngularCompileHeaders = function() { return isTrue(this.gridOptions.angularCompileHeaders); };
GridOptionsWrapper.prototype.getColumnDefs = function() { return this.gridOptions.columnDefs; };
GridOptionsWrapper.prototype.getRowHeight = function() { return this.gridOptions.rowHeight; };
GridOptionsWrapper.prototype.getModelUpdated = function() { return this.gridOptions.modelUpdated; };
GridOptionsWrapper.prototype.getCellClicked = function() { return this.gridOptions.cellClicked; };
GridOptionsWrapper.prototype.getCellDoubleClicked = function() { return this.gridOptions.cellDoubleClicked; };
GridOptionsWrapper.prototype.getCellValueChanged = function() { return this.gridOptions.cellValueChanged; };
GridOptionsWrapper.prototype.getRowSelected = function() { return this.gridOptions.rowSelected; };
GridOptionsWrapper.prototype.getSelectionChanged = function() { return this.gridOptions.selectionChanged; };
GridOptionsWrapper.prototype.getVirtualRowRemoved = function() { return this.gridOptions.virtualRowRemoved; };
GridOptionsWrapper.prototype.getDatasource = function() { return this.gridOptions.datasource; };
GridOptionsWrapper.prototype.getReady = function() { return this.gridOptions.ready; };
GridOptionsWrapper.prototype.getRowBuffer = function() { return this.gridOptions.rowBuffer; };

GridOptionsWrapper.prototype.setSelectedRows = function(newSelectedRows) {
    return this.gridOptions.selectedRows = newSelectedRows;
};
GridOptionsWrapper.prototype.setSelectedNodesById = function(newSelectedNodes) {
    return this.gridOptions.selectedNodesById = newSelectedNodes;
};

GridOptionsWrapper.prototype.getIcons = function() {
    return this.gridOptions.icons;
};

GridOptionsWrapper.prototype.isDoInternalGrouping = function() {
    return !this.isRowsAlreadyGrouped() && this.gridOptions.groupKeys;
};

GridOptionsWrapper.prototype.getHeaderHeight = function() {
    if (typeof this.gridOptions.headerHeight === 'number') {
        // if header height provided, used it
        return this.gridOptions.headerHeight;
    } else {
        // otherwise return 25 if no grouping, 50 if grouping
        if (this.isGroupHeaders()) {
            return 50;
        } else {
            return 25;
        }
    }
};

GridOptionsWrapper.prototype.setupDefaults = function() {
    if (!this.gridOptions.rowHeight) {
        this.gridOptions.rowHeight = DEFAULT_ROW_HEIGHT;
    }
};

GridOptionsWrapper.prototype.getPinnedColCount = function() {
    // if not using scrolls, then pinned columns doesn't make
    // sense, so always return 0
    if (this.isDontUseScrolls()) {
        return 0;
    }
    if (this.gridOptions.pinnedColumnCount) {
        //in case user puts in a string, cast to number
        return Number(this.gridOptions.pinnedColumnCount);
    } else {
        return 0;
    }
};

module.exports = GridOptionsWrapper;

},{}],15:[function(require,module,exports){
function GroupCreator() {}

GroupCreator.prototype.group = function(rowNodes, groupByFields, groupAggFunction, expandByDefault) {

    var topMostGroup = {
        level: -1,
        children: [],
        childrenMap: {}
    };

    var allGroups = [];
    allGroups.push(topMostGroup);

    var levelToInsertChild = groupByFields.length - 1;
    var i, currentLevel, node, data, currentGroup, groupByField, groupKey, nextGroup;

    // start at -1 and go backwards, as all the positive indexes
    // are already used by the nodes.
    var index = -1;

    for (i = 0; i < rowNodes.length; i++) {
        node = rowNodes[i];
        data = node.data;

        // all leaf nodes have the same level in this grouping, which is one level after the last group
        node.level = levelToInsertChild + 1;

        for (currentLevel = 0; currentLevel < groupByFields.length; currentLevel++) {
            groupByField = groupByFields[currentLevel];
            groupKey = data[groupByField];

            if (currentLevel == 0) {
                currentGroup = topMostGroup;
            }

            // if group doesn't exist yet, create it
            nextGroup = currentGroup.childrenMap[groupKey];
            if (!nextGroup) {
                nextGroup = {
                    group: true,
                    field: groupByField,
                    id: index--,
                    key: groupKey,
                    expanded: this.isExpanded(expandByDefault, currentLevel),
                    children: [],
                    // for top most level, parent is null
                    parent: currentGroup === topMostGroup ? null : currentGroup,
                    allChildrenCount: 0,
                    level: currentGroup.level + 1,
                    childrenMap: {} //this is a temporary map, we remove at the end of this method
                };
                currentGroup.childrenMap[groupKey] = nextGroup;
                currentGroup.children.push(nextGroup);
                allGroups.push(nextGroup);
            }

            nextGroup.allChildrenCount++;

            if (currentLevel == levelToInsertChild) {
                node.parent = nextGroup === topMostGroup ? null : nextGroup;
                nextGroup.children.push(node);
            } else {
                currentGroup = nextGroup;
            }
        }

    }

    //remove the temporary map
    for (i = 0; i < allGroups.length; i++) {
        delete allGroups[i].childrenMap;
    }

    return topMostGroup.children;
};

GroupCreator.prototype.isExpanded = function(expandByDefault, level) {
    if (typeof expandByDefault === 'number') {
        return level < expandByDefault;
    } else {
        return expandByDefault === true || expandByDefault === 'true';
    }
};

module.exports = new GroupCreator();

},{}],16:[function(require,module,exports){
var utils = require('./utils');
var SvgFactory = require('./svgFactory');
var constants = require('./constants');

var svgFactory = new SvgFactory();

function HeaderRenderer() {}

HeaderRenderer.prototype.init = function(gridOptionsWrapper, columnController, columnModel, eGrid, angularGrid, filterManager, $scope, $compile) {
    this.gridOptionsWrapper = gridOptionsWrapper;
    this.columnModel = columnModel;
    this.columnController = columnController;
    this.angularGrid = angularGrid;
    this.filterManager = filterManager;
    this.$scope = $scope;
    this.$compile = $compile;
    this.findAllElements(eGrid);
};

HeaderRenderer.prototype.findAllElements = function(eGrid) {

    if (this.gridOptionsWrapper.isDontUseScrolls()) {
        this.eHeaderContainer = eGrid.querySelector(".ag-header-container");
        this.eRoot = eGrid.querySelector(".ag-root");
        // for no-scroll, all header cells live in the header container (the ag-header doesn't exist)
        this.eHeaderParent = this.eHeaderContainer;
    } else {
        this.ePinnedHeader = eGrid.querySelector(".ag-pinned-header");
        this.eHeaderContainer = eGrid.querySelector(".ag-header-container");
        this.eHeader = eGrid.querySelector(".ag-header");
        this.eRoot = eGrid.querySelector(".ag-root");
        // for scroll, all header cells live in the header (contains both normal and pinned headers)
        this.eHeaderParent = this.eHeader;
    }
};

HeaderRenderer.prototype.refreshHeader = function() {
    utils.removeAllChildren(this.ePinnedHeader);
    utils.removeAllChildren(this.eHeaderContainer);

    if (this.childScopes) {
        this.childScopes.forEach(function(childScope) {
            childScope.$destroy();
        });
    }
    this.childScopes = [];

    if (this.gridOptionsWrapper.isGroupHeaders()) {
        this.insertHeadersWithGrouping();
    } else {
        this.insertHeadersWithoutGrouping();
    }

};

HeaderRenderer.prototype.insertHeadersWithGrouping = function() {
    var groups = this.columnModel.getColumnGroups();
    var that = this;
    groups.forEach(function(group) {
        var eHeaderCell = that.createGroupedHeaderCell(group);
        var eContainerToAddTo = group.pinned ? that.ePinnedHeader : that.eHeaderContainer;
        eContainerToAddTo.appendChild(eHeaderCell);
    });
};

HeaderRenderer.prototype.createGroupedHeaderCell = function(group) {

    var eHeaderGroup = document.createElement('div');
    eHeaderGroup.className = 'ag-header-group';

    var eHeaderGroupCell = document.createElement('div');
    group.eHeaderGroupCell = eHeaderGroupCell;
    var classNames = ['ag-header-group-cell'];
    // having different classes below allows the style to not have a bottom border
    // on the group header, if no group is specified
    if (group.name) {
        classNames.push('ag-header-group-cell-with-group');
    } else {
        classNames.push('ag-header-group-cell-no-group');
    }
    eHeaderGroupCell.className = classNames.join(' ');

    if (this.gridOptionsWrapper.isEnableColResize()) {
        var eHeaderCellResize = document.createElement("div");
        eHeaderCellResize.className = "ag-header-cell-resize";
        eHeaderGroupCell.appendChild(eHeaderCellResize);
        group.eHeaderCellResize = eHeaderCellResize;
        var dragCallback = this.groupDragCallbackFactory(group);
        this.addDragHandler(eHeaderCellResize, dragCallback);
    }

    // no renderer, default text render
    var groupName = group.name;
    if (groupName && groupName !== '') {
        var eGroupCellLabel = document.createElement("div");
        eGroupCellLabel.className = 'ag-header-group-cell-label';
        eHeaderGroupCell.appendChild(eGroupCellLabel);

        var eInnerText = document.createElement("span");
        eInnerText.className = 'ag-header-group-text';
        eInnerText.innerHTML = groupName;
        eGroupCellLabel.appendChild(eInnerText);

        if (group.expandable) {
            this.addGroupExpandIcon(group, eGroupCellLabel, group.expanded);
        }
    }
    eHeaderGroup.appendChild(eHeaderGroupCell);

    var that = this;
    group.visibleColumns.forEach(function(column) {
        var eHeaderCell = that.createHeaderCell(column, true, group);
        eHeaderGroup.appendChild(eHeaderCell);
    });

    that.setWidthOfGroupHeaderCell(group);

    return eHeaderGroup;
};

HeaderRenderer.prototype.addGroupExpandIcon = function(group, eHeaderGroup, expanded) {
    var eGroupIcon;
    if (expanded) {
        eGroupIcon = utils.createIcon('columnGroupOpened', this.gridOptionsWrapper, null, svgFactory.createArrowLeftSvg);
    } else {
        eGroupIcon = utils.createIcon('columnGroupClosed', this.gridOptionsWrapper, null, svgFactory.createArrowRightSvg);
    }
    eGroupIcon.className = 'ag-header-expand-icon';
    eHeaderGroup.appendChild(eGroupIcon);

    var that = this;
    eGroupIcon.onclick = function() {
        that.columnController.columnGroupOpened(group);
    };
};

HeaderRenderer.prototype.addDragHandler = function(eDraggableElement, dragCallback) {
    var that = this;
    eDraggableElement.onmousedown = function(downEvent) {
        dragCallback.onDragStart();
        that.eRoot.style.cursor = "col-resize";
        that.dragStartX = downEvent.clientX;

        that.eRoot.onmousemove = function(moveEvent) {
            var newX = moveEvent.clientX;
            var change = newX - that.dragStartX;
            dragCallback.onDragging(change);
        };
        that.eRoot.onmouseup = function() {
            that.stopDragging();
        };
        that.eRoot.onmouseleave = function() {
            that.stopDragging();
        };
    };
};

HeaderRenderer.prototype.setWidthOfGroupHeaderCell = function(headerGroup) {
    var totalWidth = 0;
    headerGroup.visibleColumns.forEach(function(column) {
        totalWidth += column.actualWidth;
    });
    headerGroup.eHeaderGroupCell.style.width = utils.formatWidth(totalWidth);
    headerGroup.actualWidth = totalWidth;
};

HeaderRenderer.prototype.insertHeadersWithoutGrouping = function() {
    var ePinnedHeader = this.ePinnedHeader;
    var eHeaderContainer = this.eHeaderContainer;
    var that = this;

    this.columnModel.getVisibleColumns().forEach(function(column) {
        // only include the first x cols
        var headerCell = that.createHeaderCell(column, false);
        if (column.pinned) {
            ePinnedHeader.appendChild(headerCell);
        } else {
            eHeaderContainer.appendChild(headerCell);
        }
    });
};

HeaderRenderer.prototype.createHeaderCell = function(column, grouped, headerGroup) {
    var that = this;
    var colDef = column.colDef;
    var eHeaderCell = document.createElement("div");
    // stick the header cell in column, as we access it when group is re-sized
    column.eHeaderCell = eHeaderCell;

    var headerCellClasses = ['ag-header-cell'];
    if (grouped) {
        headerCellClasses.push('ag-header-cell-grouped'); // this takes 50% height
    } else {
        headerCellClasses.push('ag-header-cell-not-grouped'); // this takes 100% height
    }
    eHeaderCell.className = headerCellClasses.join(' ');

    // add tooltip if exists
    if (colDef.headerTooltip) {
        eHeaderCell.title = colDef.headerTooltip;
    }

    if (this.gridOptionsWrapper.isEnableColResize()) {
        var headerCellResize = document.createElement("div");
        headerCellResize.className = "ag-header-cell-resize";
        eHeaderCell.appendChild(headerCellResize);
        var dragCallback = this.headerDragCallbackFactory(eHeaderCell, column, headerGroup);
        this.addDragHandler(headerCellResize, dragCallback);
    }

    // filter button
    var showMenu = this.gridOptionsWrapper.isEnableFilter() && !colDef.suppressMenu;
    if (showMenu) {
        var eMenuButton = utils.createIcon('menu', this.gridOptionsWrapper, column, svgFactory.createMenuSvg);
        utils.addCssClass(eMenuButton, 'ag-header-icon');

        eMenuButton.setAttribute("class", "ag-header-cell-menu-button");
        eMenuButton.onclick = function() {
            that.filterManager.showFilter(column, this);
        };
        eHeaderCell.appendChild(eMenuButton);
        eHeaderCell.onmouseenter = function() {
            eMenuButton.style.opacity = 1;
        };
        eHeaderCell.onmouseleave = function() {
            eMenuButton.style.opacity = 0;
        };
        eMenuButton.style.opacity = 0;
        eMenuButton.style["-webkit-transition"] = "opacity 0.5s, border 0.2s";
        eMenuButton.style["transition"] = "opacity 0.5s, border 0.2s";
    }

    // label div
    var headerCellLabel = document.createElement("div");
    headerCellLabel.className = "ag-header-cell-label";

    // add in sort icons
    if (this.gridOptionsWrapper.isEnableSorting() && !colDef.suppressSorting) {
        column.eSortAsc = utils.createIcon('sortAscending', this.gridOptionsWrapper, column, svgFactory.createArrowUpSvg);
        column.eSortDesc = utils.createIcon('sortDescending', this.gridOptionsWrapper, column, svgFactory.createArrowDownSvg);
        utils.addCssClass(column.eSortAsc, 'ag-header-icon');
        utils.addCssClass(column.eSortDesc, 'ag-header-icon');
        headerCellLabel.appendChild(column.eSortAsc);
        headerCellLabel.appendChild(column.eSortDesc);
        column.eSortAsc.style.display = 'none';
        column.eSortDesc.style.display = 'none';
        this.addSortHandling(headerCellLabel, column);
    }

    // add in filter icon
    column.eFilterIcon = utils.createIcon('filter', this.gridOptionsWrapper, column, svgFactory.createFilterSvg);
    utils.addCssClass(column.eFilterIcon, 'ag-header-icon');
    headerCellLabel.appendChild(column.eFilterIcon);

    // render the cell, use a renderer if one is provided
    var headerCellRenderer;
    if (colDef.headerCellRenderer) { // first look for a renderer in col def
        headerCellRenderer = colDef.headerCellRenderer;
    } else if (this.gridOptionsWrapper.getHeaderCellRenderer()) { // second look for one in grid options
        headerCellRenderer = this.gridOptionsWrapper.getHeaderCellRenderer();
    }
    if (headerCellRenderer) {
        // renderer provided, use it
        var newChildScope;
        if (this.gridOptionsWrapper.isAngularCompileHeaders()) {
            newChildScope = this.$scope.$new();
        }
        var cellRendererParams = {
            colDef: colDef,
            $scope: newChildScope,
            context: this.gridOptionsWrapper.getContext(),
            api: this.gridOptionsWrapper.getApi()
        };
        var cellRendererResult = headerCellRenderer(cellRendererParams);
        var childToAppend;
        if (utils.isNodeOrElement(cellRendererResult)) {
            // a dom node or element was returned, so add child
            childToAppend = cellRendererResult;
        } else {
            // otherwise assume it was html, so just insert
            var eTextSpan = document.createElement("span");
            eTextSpan.innerHTML = cellRendererResult;
            childToAppend = eTextSpan;
        }
        // angular compile header if option is turned on
        if (this.gridOptionsWrapper.isAngularCompileHeaders()) {
            newChildScope.colDef = colDef;
            newChildScope.colIndex = colDef.index;
            newChildScope.colDefWrapper = column;
            this.childScopes.push(newChildScope);
            var childToAppendCompiled = this.$compile(childToAppend)(newChildScope)[0];
            headerCellLabel.appendChild(childToAppendCompiled);
        } else {
            headerCellLabel.appendChild(childToAppend);
        }
    } else {
        // no renderer, default text render
        var eInnerText = document.createElement("span");
        eInnerText.className = 'ag-header-cell-text';
        eInnerText.innerHTML = colDef.displayName;
        headerCellLabel.appendChild(eInnerText);
    }

    eHeaderCell.appendChild(headerCellLabel);
    eHeaderCell.style.width = utils.formatWidth(column.actualWidth);

    return eHeaderCell;
};

HeaderRenderer.prototype.addSortHandling = function(headerCellLabel, colDefWrapper) {
    var that = this;

    headerCellLabel.addEventListener("click", function(e) {

        // update sort on current col
        if (colDefWrapper.sort === constants.DESC) {
            colDefWrapper.sort = null
        }
        else {
            if (colDefWrapper.sort === constants.ASC) {
                colDefWrapper.sort = constants.DESC;
            } else {
                colDefWrapper.sort = constants.ASC;
            }
            // Useful for determining the order in which the user sorted the columns:
            colDefWrapper.sortedAt = new Date().valueOf();
        }

        // clear sort on all columns except this one, and update the icons
        that.columnModel.getAllColumns().forEach(function(columnToClear) {
            // Do not clear if either holding shift, or if column in question was clicked
            if (!(e.shiftKey || columnToClear === colDefWrapper)) {
                columnToClear.sort = null;
            }

            // check in case no sorting on this particular col, as sorting is optional per col
            if (columnToClear.colDef.suppressSorting) {
                return;
            }

            // update visibility of icons
            var sortAscending = columnToClear.sort === constants.ASC;
            var sortDescending = columnToClear.sort === constants.DESC;

            if (columnToClear.eSortAsc) {
                columnToClear.eSortAsc.style.display = sortAscending ? 'inline' : 'none';
            }
            if (columnToClear.eSortDesc) {
                columnToClear.eSortDesc.style.display = sortDescending ? 'inline' : 'none';
            }
        });

        that.angularGrid.updateModelAndRefresh(constants.STEP_SORT);
    });
};

HeaderRenderer.prototype.groupDragCallbackFactory = function(currentGroup) {
    var parent = this;
    var visibleColumns = currentGroup.visibleColumns;
    return {
        onDragStart: function() {
            this.groupWidthStart = currentGroup.actualWidth;
            this.childrenWidthStarts = [];
            var that = this;
            visibleColumns.forEach(function(colDefWrapper) {
                that.childrenWidthStarts.push(colDefWrapper.actualWidth);
            });
            this.minWidth = visibleColumns.length * constants.MIN_COL_WIDTH;
        },
        onDragging: function(dragChange) {

            var newWidth = this.groupWidthStart + dragChange;
            if (newWidth < this.minWidth) {
                newWidth = this.minWidth;
            }

            // set the new width to the group header
            var newWidthPx = newWidth + "px";
            currentGroup.eHeaderGroupCell.style.width = newWidthPx;
            currentGroup.actualWidth = newWidth;

            // distribute the new width to the child headers
            var changeRatio = newWidth / this.groupWidthStart;
            // keep track of pixels used, and last column gets the remaining,
            // to cater for rounding errors, and min width adjustments
            var pixelsToDistribute = newWidth;
            var that = this;
            currentGroup.visibleColumns.forEach(function(colDefWrapper, index) {
                var notLastCol = index !== (visibleColumns.length - 1);
                var newChildSize;
                if (notLastCol) {
                    // if not the last col, calculate the column width as normal
                    var startChildSize = that.childrenWidthStarts[index];
                    newChildSize = startChildSize * changeRatio;
                    if (newChildSize < constants.MIN_COL_WIDTH) {
                        newChildSize = constants.MIN_COL_WIDTH;
                    }
                    pixelsToDistribute -= newChildSize;
                } else {
                    // if last col, give it the remaining pixels
                    newChildSize = pixelsToDistribute;
                }
                var eHeaderCell = visibleColumns[index].eHeaderCell;
                parent.adjustColumnWidth(newChildSize, colDefWrapper, eHeaderCell);
            });

            // should not be calling these here, should do something else
            if (currentGroup.pinned) {
                parent.angularGrid.updatePinnedColContainerWidthAfterColResize();
            } else {
                parent.angularGrid.updateBodyContainerWidthAfterColResize();
            }
        }
    };
};

HeaderRenderer.prototype.adjustColumnWidth = function(newWidth, column, eHeaderCell) {
    var newWidthPx = newWidth + "px";
    var selectorForAllColsInCell = ".cell-col-" + column.index;
    var cellsForThisCol = this.eRoot.querySelectorAll(selectorForAllColsInCell);
    for (var i = 0; i < cellsForThisCol.length; i++) {
        cellsForThisCol[i].style.width = newWidthPx;
    }

    eHeaderCell.style.width = newWidthPx;
    column.actualWidth = newWidth;
};

// gets called when a header (not a header group) gets resized
HeaderRenderer.prototype.headerDragCallbackFactory = function(headerCell, column, headerGroup) {
    var parent = this;
    return {
        onDragStart: function() {
            this.startWidth = column.actualWidth;
        },
        onDragging: function(dragChange) {
            var newWidth = this.startWidth + dragChange;
            if (newWidth < constants.MIN_COL_WIDTH) {
                newWidth = constants.MIN_COL_WIDTH;
            }

            parent.adjustColumnWidth(newWidth, column, headerCell);

            if (headerGroup) {
                parent.setWidthOfGroupHeaderCell(headerGroup);
            }

            // should not be calling these here, should do something else
            if (column.pinned) {
                parent.angularGrid.updatePinnedColContainerWidthAfterColResize();
            } else {
                parent.angularGrid.updateBodyContainerWidthAfterColResize();
            }
        }
    };
};

HeaderRenderer.prototype.stopDragging = function() {
    this.eRoot.style.cursor = "";
    this.eRoot.onmouseup = null;
    this.eRoot.onmouseleave = null;
    this.eRoot.onmousemove = null;
};

HeaderRenderer.prototype.updateFilterIcons = function() {
    var that = this;
    this.columnModel.getVisibleColumns().forEach(function(column) {
        // todo: need to change this, so only updates if column is visible
        if (column.eFilterIcon) {
            var filterPresent = that.filterManager.isFilterPresentForCol(column.colKey);
            var displayStyle = filterPresent ? 'inline' : 'none';
            column.eFilterIcon.style.display = displayStyle;
        }
    });
};

module.exports = HeaderRenderer;

},{"./constants":3,"./svgFactory":23,"./utils":27}],17:[function(require,module,exports){
var groupCreator = require('./groupCreator');
var utils = require('./utils');
var constants = require('./constants');

function InMemoryRowController() {
    this.createModel();
}

InMemoryRowController.prototype.init = function(gridOptionsWrapper, columnModel, angularGrid, filterManager, $scope, expressionService) {
    this.gridOptionsWrapper = gridOptionsWrapper;
    this.columnModel = columnModel;
    this.angularGrid = angularGrid;
    this.filterManager = filterManager;
    this.$scope = $scope;
    this.expressionService = expressionService;

    this.allRows = null;
    this.rowsAfterGroup = null;
    this.rowsAfterFilter = null;
    this.rowsAfterSort = null;
    this.rowsAfterMap = null;
};

// private
InMemoryRowController.prototype.createModel = function() {
    var that = this;
    this.model = {
        // this method is implemented by the inMemory model only,
        // it gives the top level of the selection. used by the selection
        // controller, when it needs to do a full traversal
        getTopLevelNodes: function() {
            return that.rowsAfterGroup;
        },
        getVirtualRow: function(index) {
            return that.rowsAfterMap[index];
        },
        importSettings: function(settings){
            if(settings.filters){
                var cols = that.columnModel.getAllColumns();
                for(var i = 0; i < cols.length; i++){
                    that.filterManager.createFilter(cols[i]);
                    var createdFilter = that.filterManager.allFilters[i];
                    var config = settings.filters[cols[i].colDef.field];
                    if(config){
                        var newVal, selectedFilters;
                        if(config.SetFilter && createdFilter.filter.model && createdFilter.filter.model.selectNothing){
                            createdFilter.filter.model.selectNothing();
                            createdFilter.filter.model.selectedValuesMap = createdFilter.filter.model.selectedValuesMap || {};
                            config.SetFilter.forEach(function(v){
                                createdFilter.filter.model.selectValue(v);
                            });
                        }
                        else if(config.TextFilter){
                            createdFilter.filter.eFilterTextField.value = createdFilter.filter.filterText = config.TextFilter.filterText;
                            createdFilter.filter.eTypeSelect.value = createdFilter.filter.filterType = config.TextFilter.filterType;
                        }
                        else if(config.NumberFilter){
                            createdFilter.filter.eFilterTextField.value = createdFilter.filter.filterNumber = config.TextFilter.filterNumber;
                            createdFilter.filter.eTypeSelect.value = createdFilter.filter.filterType = config.TextFilter.filterType;
                        }
                        else if(config.BidNameFilter){
                            createdFilter.filter.numberText = config.BidNameFilter.numberText;
                        }
                        else if(config.DateFilter){
                            createdFilter.filter.selectedDatePeriod = config.DateFilter;
                        }
                        else if(config.MultiValueSelectFilter){
                            selectedFilters = config.MultiValueSelectFilter;
                            newVal = createdFilter.filter.values;
                            if(newVal && newVal.length > 0){
                                newVal.forEach(function(acq){
                                    if(selectedFilters.indexOf(acq.name) > -1){
                                        acq.selected = true;
                                    }
                                });
                                that.doFilter();
                                that.angularGrid.updateModelAndRefresh(constants.STEP_FILTER);
                                that.angularGrid.headerRenderer.updateFilterIcons();
                            }
                        }
                    }
                }
                that.doFilter();
            }

            if(settings.orderByField){
                var orderByCols = that.columnModel.getAllColumns().forEach(function(c){
                    if(c && c.colDef.field === settings.orderByField){
                        c.sort = settings.orderByDirection;
                        if(c.eSortAsc && c.eSortDesc){
                            c.eSortAsc.style.display = settings.orderByDirection === 'asc' ? 'inline' : 'none';
                            c.eSortDesc.style.display = settings.orderByDirection !== 'asc' ? 'inline' : 'none'; 
                        }
                    }
                });
                that.doSort();
            }

            that.angularGrid.updateModelAndRefresh(constants.STEP_EVERYTHING);
            that.angularGrid.headerRenderer.updateFilterIcons();
        },
        exportSettings: function(){
            var orderByColumn = that.columnModel.getAllColumns().filter(function(c){
                return !!c.sort;
            });

            var cleanedFilters = {};
            Object.keys(that.filterManager.allFilters).forEach(function(key){
                var filterWrapper = that.filterManager.allFilters[key];
                var config;

                if(!filterWrapper.filter.isFilterActive()){
                    return;
                }

                if(filterWrapper.filter.model && filterWrapper.filter.model.selectedValuesMap){
                    config = {
                        SetFilter : Object.keys(filterWrapper.filter.model.selectedValuesMap)
                    };
                }
                else if(filterWrapper.filter.filterNumber){
                    config = {
                        NumberFilter : {
                            filterNumber: filterWrapper.filter.filterNumber,
                            filterType: filterWrapper.filter.filterType
                        }
                    };
                }
                else if(filterWrapper.filter.filterText){
                    config = {
                        TextFilter : {
                            filterText: filterWrapper.filter.filterText,
                            filterType: filterWrapper.filter.filterType
                        }
                    };
                }
                else if(filterWrapper.filter.selectedDatePeriod){
                    config = {
                        DateFilter : filterWrapper.filter.selectedDatePeriod
                    };
                }
                else if(filterWrapper.filter.values){
                    config = {
                        MultiValueSelectFilter : filterWrapper.filter.values.filter(function(acq){
                          return acq.selected;
                        }).map(function(acq){
                            return acq.name;
                        })
                    };
                }
                cleanedFilters[filterWrapper.field] = config;
            });

            return {
                orderByField: orderByColumn.length > 0 ? orderByColumn[0].colDef.field : null,
                orderByDirection: orderByColumn.length > 0 ? orderByColumn[0].sort : null,
                filters: cleanedFilters
            };
        },
        getVirtualRowCount: function() {
            if (that.rowsAfterMap) {
                return that.rowsAfterMap.length;
            } else {
                return 0;
            }
        }
    };
};

// public
InMemoryRowController.prototype.getModel = function() {
    return this.model;
};

// public
InMemoryRowController.prototype.updateModel = function(step) {

    // fallthrough in below switch is on purpose
    switch (step) {
        case constants.STEP_EVERYTHING:
            this.doGrouping();
        case constants.STEP_FILTER:
            this.doFilter();
            this.doAggregate();
        case constants.STEP_SORT:
            this.doSort();
        case constants.STEP_MAP:
            this.doGroupMapping();
    }

    if (typeof this.gridOptionsWrapper.getModelUpdated() === 'function') {
        this.gridOptionsWrapper.getModelUpdated()();
        var $scope = this.$scope;
        if ($scope) {
            setTimeout(function() {
                $scope.$apply();
            }, 0);
        }
    }

};

// private
InMemoryRowController.prototype.getValue = function(data, colDef, node, rowIndex) {
    var api = this.gridOptionsWrapper.getApi();
    var context = this.gridOptionsWrapper.getContext();
    return utils.getValue(this.expressionService, data, colDef, node, rowIndex, api, context);
};

// public - it's possible to recompute the aggregate without doing the other parts
InMemoryRowController.prototype.doAggregate = function() {

    var groupAggFunction = this.gridOptionsWrapper.getGroupAggFunction();
    if (typeof groupAggFunction !== 'function') {
        return;
    }

    this.recursivelyCreateAggData(this.rowsAfterFilter, groupAggFunction);
};

// public
InMemoryRowController.prototype.expandOrCollapseAll = function(expand, rowNodes) {
    // if first call in recursion, we set list to parent list
    if (rowNodes === null) {
        rowNodes = this.rowsAfterGroup;
    }

    if (!rowNodes) {
        return;
    }

    var _this = this;
    rowNodes.forEach(function(node) {
        if (node.group) {
            node.expanded = expand;
            _this.expandOrCollapseAll(expand, node.children);
        }
    });
};

// private
InMemoryRowController.prototype.recursivelyCreateAggData = function(nodes, groupAggFunction) {
    for (var i = 0, l = nodes.length; i < l; i++) {
        var node = nodes[i];
        if (node.group) {
            // agg function needs to start at the bottom, so traverse first
            this.recursivelyCreateAggData(node.childrenAfterFilter, groupAggFunction);
            // after traversal, we can now do the agg at this level
            var data = groupAggFunction(node.childrenAfterFilter);
            node.data = data;
            // if we are grouping, then it's possible there is a sibling footer
            // to the group, so update the data here also if there is one
            if (node.sibling) {
                node.sibling.data = data;
            }
        }
    }
};

// private
InMemoryRowController.prototype.doSort = function() {
    //see if there is a col we are sorting by
    var sortingOptions = [];
    this.columnModel.getAllColumns().forEach(function(column) {
        if (column.sort) {
            var ascending = column.sort === constants.ASC;
            sortingOptions.push({
                inverter: ascending ? 1 : -1,
                sortedAt: column.sortedAt,
                colDef: column.colDef
            });
        }
    });

    // The columns are to be sorted in the order that the user selected them:
    sortingOptions.sort(function(optionA, optionB){
        return optionA.sortedAt - optionB.sortedAt;
    });

    var rowNodesBeforeSort = this.rowsAfterFilter.slice(0);

    if (sortingOptions.length) {
        this.sortList(rowNodesBeforeSort, sortingOptions);
    } else {
        // if no sorting, set all group children after sort to the original list
        this.recursivelyResetSort(rowNodesBeforeSort);
    }

    this.rowsAfterSort = rowNodesBeforeSort;
};

// private
InMemoryRowController.prototype.recursivelyResetSort = function(rowNodes) {
    for (var i = 0, l = rowNodes.length; i < l; i++) {
        var item = rowNodes[i];
        if (item.group && item.children) {
            item.childrenAfterSort = item.childrenAfterFilter;
            this.recursivelyResetSort(item.children);
        }
    }
};

// private
InMemoryRowController.prototype.sortList = function(nodes, sortOptions) {

    // sort any groups recursively
    for (var i = 0, l = nodes.length; i < l; i++) { // critical section, no functional programming
        var node = nodes[i];
        if (node.group && node.children) {
            node.childrenAfterSort = node.childrenAfterFilter.slice(0);
            this.sortList(node.childrenAfterSort, sortOptions);
        }
    }

    var that = this;
    function compare(objA, objB, colDef){
        var valueA = that.getValue(objA.data, colDef, objA);
        var valueB = that.getValue(objB.data, colDef, objB);
        if (colDef.comparator) {
            //if comparator provided, use it
            return colDef.comparator(valueA, valueB, objA, objB);
        } else {
            //otherwise do our own comparison
            return utils.defaultComparator(valueA, valueB, objA, objB);
        }
    }

    nodes.sort(function(objA, objB) {
        // Iterate columns, return the first that doesn't match
        for (var i = 0, len = sortOptions.length; i < len; i++) {
            var sortOption = sortOptions[i];
            var compared = compare(objA, objB, sortOption.colDef);
            if (compared !== 0) {
                return compared * sortOption.inverter;
            }
        }
        // All matched, these are identical as far as the sort is concerned:
        return 0;
    });
};

// private
InMemoryRowController.prototype.doGrouping = function() {
    var rowsAfterGroup;
    if (this.gridOptionsWrapper.isDoInternalGrouping()) {
        var expandByDefault = this.gridOptionsWrapper.getGroupDefaultExpanded();
        rowsAfterGroup = groupCreator.group(this.allRows, this.gridOptionsWrapper.getGroupKeys(),
            this.gridOptionsWrapper.getGroupAggFunction(), expandByDefault);
    } else {
        rowsAfterGroup = this.allRows;
    }
    this.rowsAfterGroup = rowsAfterGroup;
};

// private
InMemoryRowController.prototype.doFilter = function() {
    var quickFilterPresent = this.angularGrid.getQuickFilter() !== null;
    var advancedFilterPresent = this.filterManager.isFilterPresent();
    var filterPresent = quickFilterPresent || advancedFilterPresent;

    var rowsAfterFilter;
    if (filterPresent) {
        rowsAfterFilter = this.filterItems(this.rowsAfterGroup, quickFilterPresent, advancedFilterPresent);
    } else {
        // do it here
        rowsAfterFilter = this.rowsAfterGroup;
        this.recursivelyResetFilter(this.rowsAfterGroup);
    }
    this.rowsAfterFilter = rowsAfterFilter;
};

// private
InMemoryRowController.prototype.filterItems = function(rowNodes, quickFilterPresent, advancedFilterPresent) {
    var result = [];

    for (var i = 0, l = rowNodes.length; i < l; i++) {
        var node = rowNodes[i];

        if (node.group) {
            // deal with group
            node.childrenAfterFilter = this.filterItems(node.children, quickFilterPresent, advancedFilterPresent);
            if (node.childrenAfterFilter.length > 0) {
                node.allChildrenCount = this.getTotalChildCount(node.childrenAfterFilter);
                result.push(node);
            }
        } else {
            if (this.doesRowPassFilter(node, quickFilterPresent, advancedFilterPresent)) {
                result.push(node);
            }
        }
    }

    return result;
};

// private
InMemoryRowController.prototype.recursivelyResetFilter = function(nodes) {
    for (var i = 0, l = nodes.length; i < l; i++) {
        var node = nodes[i];
        if (node.group && node.children) {
            node.childrenAfterFilter = node.children;
            node.allChildrenCount = this.getTotalChildCount(node.childrenAfterFilter);
            this.recursivelyResetFilter(node.children);
        }
    }
};

// private
// rows: the rows to put into the model
// firstId: the first id to use, used for paging, where we are not on the first page
InMemoryRowController.prototype.setAllRows = function(rows, firstId) {
    var nodes;
    if (this.gridOptionsWrapper.isRowsAlreadyGrouped()) {
        nodes = rows;
        this.recursivelyCheckUserProvidedNodes(nodes, null, 0);
    } else {
        // place each row into a wrapper
        var nodes = [];
        if (rows) {
            for (var i = 0; i < rows.length; i++) { // could be lots of rows, don't use functional programming
                nodes.push({
                    data: rows[i]
                });
            }
        }
    }

    // if firstId provided, use it, otherwise start at 0
    var firstIdToUse = firstId ? firstId : 0;
    this.recursivelyAddIdToNodes(nodes, firstIdToUse);
    this.allRows = nodes;
};

// add in index - this is used by the selectionController - so quick
// to look up selected rows
InMemoryRowController.prototype.recursivelyAddIdToNodes = function(nodes, index) {
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        node.id = index++;
        if (node.group && node.children) {
            index = this.recursivelyAddIdToNodes(node.children, index);
        }
    }
    return index;
};

// add in index - this is used by the selectionController - so quick
// to look up selected rows
InMemoryRowController.prototype.recursivelyCheckUserProvidedNodes = function(nodes, parent, level) {
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (parent) {
            node.parent = parent;
        }
        node.level = level;
        if (node.group && node.children) {
            this.recursivelyCheckUserProvidedNodes(node.children, node, level + 1);
        }
    }
};

// private
InMemoryRowController.prototype.getTotalChildCount = function(rowNodes) {
    var count = 0;
    for (var i = 0, l = rowNodes.length; i < l; i++) {
        var item = rowNodes[i];
        if (item.group) {
            count += item.allChildrenCount;
        } else {
            count++;
        }
    }
    return count;
};

// private
InMemoryRowController.prototype.copyGroupNode = function(groupNode, children, allChildrenCount) {
    return {
        group: true,
        data: groupNode.data,
        field: groupNode.field,
        key: groupNode.key,
        expanded: groupNode.expanded,
        children: children,
        allChildrenCount: allChildrenCount,
        level: groupNode.level
    };
};

// private
InMemoryRowController.prototype.doGroupMapping = function() {
    // even if not going grouping, we do the mapping, as the client might
    // of passed in data that already has a grouping in it somewhere
    var rowsAfterMap = [];
    this.addToMap(rowsAfterMap, this.rowsAfterSort);
    this.rowsAfterMap = rowsAfterMap;
};

// private
InMemoryRowController.prototype.addToMap = function(mappedData, originalNodes) {
    if (!originalNodes) {
        return;
    }
    for (var i = 0; i < originalNodes.length; i++) {
        var node = originalNodes[i];
        mappedData.push(node);
        if (node.group && node.expanded) {
            this.addToMap(mappedData, node.childrenAfterSort);

            // put a footer in if user is looking for it
            if (this.gridOptionsWrapper.isGroupIncludeFooter()) {
                var footerNode = this.createFooterNode(node);
                mappedData.push(footerNode);
            }
        }
    }
};

// private
InMemoryRowController.prototype.createFooterNode = function(groupNode) {
    var footerNode = {};
    Object.keys(groupNode).forEach(function(key) {
        footerNode[key] = groupNode[key];
    });
    footerNode.footer = true;
    // get both header and footer to reference each other as siblings. this is never undone,
    // only overwritten. so if a group is expanded, then contracted, it will have a ghost
    // sibling - but that's fine, as we can ignore this if the header is contracted.
    footerNode.sibling = groupNode;
    groupNode.sibling = footerNode;
    return footerNode;
};

// private
InMemoryRowController.prototype.doesRowPassFilter = function(node, quickFilterPresent, advancedFilterPresent) {
    //first up, check quick filter
    if (quickFilterPresent) {
        if (!node.quickFilterAggregateText) {
            this.aggregateRowForQuickFilter(node);
        }
        if (node.quickFilterAggregateText.indexOf(this.angularGrid.getQuickFilter()) < 0) {
            //quick filter fails, so skip item
            return false;
        }
    }

    //second, check advanced filter
    if (advancedFilterPresent) {
        if (!this.filterManager.doesFilterPass(node)) {
            return false;
        }
    }

    //got this far, all filters pass
    return true;
};

// private
InMemoryRowController.prototype.aggregateRowForQuickFilter = function(node) {
    var aggregatedText = '';
    this.columnModel.getAllColumns().forEach(function(colDefWrapper) {
        var data = node.data;
        var value = data ? data[colDefWrapper.colDef.field] : null;
        if (value && value !== '') {
            aggregatedText = aggregatedText + value.toString().toUpperCase() + "_";
        }
    });
    node.quickFilterAggregateText = aggregatedText;
};

module.exports = InMemoryRowController;

},{"./constants":3,"./groupCreator":15,"./utils":27}],18:[function(require,module,exports){
// Angular Grid
// Written by Niall Crosby
// www.angulargrid.com
//
// Version 1.4.1

(function() {

    // Establish the root object, `window` or `exports`
    var root = this;
    var Grid = require('./grid');

    // if angular is present, register the directive
    if (typeof angular !== 'undefined') {
        var angularModule = angular.module("angularGrid", []);
        angularModule.directive("angularGrid", function() {
            return {
                restrict: "A",
                controller: ['$element', '$scope', '$compile', AngularDirectiveController],
                scope: {
                    angularGrid: "="
                }
            };
        });
    }

    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = angularGridGlobalFunction;
        }
        exports.angularGrid = angularGridGlobalFunction;
    }

    root.angularGrid = angularGridGlobalFunction;

    function AngularDirectiveController($element, $scope, $compile) {
        var eGridDiv = $element[0];
        var gridOptions = $scope.angularGrid;
        if (!gridOptions) {
            console.warn("WARNING - grid options for Angular Grid not found. Please ensure the attribute angular-grid points to a valid object on the scope");
            return;
        }
        var grid = new Grid(eGridDiv, gridOptions, $scope, $compile);

        $scope.$on("$destroy", function() {
            grid.setFinished();
        });
    }

    // Global Function - this function is used for creating a grid, outside of any AngularJS
    function angularGridGlobalFunction(element, gridOptions) {
        // see if element is a query selector, or a real element
        var eGridDiv;
        if (typeof element === 'string') {
            eGridDiv = document.querySelector(element);
            if (!eGridDiv) {
                console.log('WARNING - was not able to find element ' + element + ' in the DOM, Angular Grid initialisation aborted.');
                return;
            }
        } else {
            eGridDiv = element;
        }
        new Grid(eGridDiv, gridOptions, null, null);
    }

}).call(window);

},{"./grid":13}],19:[function(require,module,exports){
var TEMPLATE = [
    '<span id="pageRowSummaryPanel" class="ag-paging-row-summary-panel">',
    '<span id="firstRowOnPage"></span>',
    ' to ',
    '<span id="lastRowOnPage"></span>',
    ' of ',
    '<span id="recordCount"></span>',
    '</span>',
    '<span class="ag-paging-page-summary-panel">',
    '<button class="ag-paging-button" id="btFirst">First</button>',
    '<button class="ag-paging-button" id="btPrevious">Previous</button>',
    ' Page ',
    '<span id="current"></span>',
    ' of ',
    '<span id="total"></span>',
    '<button class="ag-paging-button" id="btNext">Next</button>',
    '<button class="ag-paging-button" id="btLast">Last</button>',
    '</span>'
].join('');

function PaginationController() {}

PaginationController.prototype.init = function(ePagingPanel, angularGrid) {
    this.angularGrid = angularGrid;
    this.populatePanel(ePagingPanel);
    this.callVersion = 0;
};

PaginationController.prototype.setDatasource = function(datasource) {
    this.datasource = datasource;

    if (!datasource) {
        // only continue if we have a valid datasource to work with
        return;
    }

    this.reset();
};

PaginationController.prototype.reset = function() {
    // copy pageSize, to guard against it changing the the datasource between calls
    this.pageSize = this.datasource.pageSize;
    // see if we know the total number of pages, or if it's 'to be decided'
    if (typeof this.datasource.rowCount === 'number' && this.datasource.rowCount >= 0) {
        this.rowCount = this.datasource.rowCount;
        this.foundMaxRow = true;
        this.calculateTotalPages();
    } else {
        this.rowCount = 0;
        this.foundMaxRow = false;
        this.totalPages = null;
    }

    this.currentPage = 0;

    // hide the summary panel until something is loaded
    this.ePageRowSummaryPanel.style.visibility = 'hidden';

    this.setTotalLabels();
    this.loadPage();
};

PaginationController.prototype.setTotalLabels = function() {
    if (this.foundMaxRow) {
        this.lbTotal.innerHTML = this.totalPages.toLocaleString();
        this.lbRecordCount.innerHTML = this.rowCount.toLocaleString();
    } else {
        this.lbTotal.innerHTML = 'more';
        this.lbRecordCount.innerHTML = 'more';
    }
};

PaginationController.prototype.calculateTotalPages = function() {
    this.totalPages = Math.floor((this.rowCount - 1) / this.pageSize) + 1;
};

PaginationController.prototype.pageLoaded = function(rows, lastRowIndex) {
    var firstId = this.currentPage * this.pageSize;
    this.angularGrid.setRows(rows, firstId);
    // see if we hit the last row
    if (!this.foundMaxRow && typeof lastRowIndex === 'number' && lastRowIndex >= 0) {
        this.foundMaxRow = true;
        this.rowCount = lastRowIndex;
        this.calculateTotalPages();
        this.setTotalLabels();

        // if overshot pages, go back
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages - 1;
            this.loadPage();
        }
    }
    this.enableOrDisableButtons();
    this.updateRowLabels();
};

PaginationController.prototype.updateRowLabels = function() {
    var startRow;
    var endRow;
    if (this.isZeroPagesToDisplay()) {
        startRow = 0;
        endRow = 0;
    } else {
        startRow = (this.pageSize * this.currentPage) + 1;
        endRow = startRow + this.pageSize - 1;
        if (this.foundMaxRow && endRow > this.rowCount) {
            endRow = this.rowCount;
        }
    }
    this.lbFirstRowOnPage.innerHTML = (startRow).toLocaleString();
    this.lbLastRowOnPage.innerHTML = (endRow).toLocaleString();

    // show the summary panel, when first shown, this is blank
    this.ePageRowSummaryPanel.style.visibility = null;
};

PaginationController.prototype.loadPage = function() {
    this.enableOrDisableButtons();
    var startRow = this.currentPage * this.datasource.pageSize;
    var endRow = (this.currentPage + 1) * this.datasource.pageSize;

    this.lbCurrent.innerHTML = (this.currentPage + 1).toLocaleString();

    this.callVersion++;
    var callVersionCopy = this.callVersion;
    var that = this;
    this.angularGrid.showLoadingPanel(true);
    this.datasource.getRows(startRow, endRow,
        function success(rows, lastRowIndex) {
            if (that.isCallDaemon(callVersionCopy)) {
                return;
            }
            that.pageLoaded(rows, lastRowIndex);
        },
        function fail() {
            if (that.isCallDaemon(callVersionCopy)) {
                return;
            }
            // set in an empty set of rows, this will at
            // least get rid of the loading panel, and
            // stop blocking things
            that.angularGrid.setRows([]);
        }
    );
};

PaginationController.prototype.isCallDaemon = function(versionCopy) {
    return versionCopy !== this.callVersion;
};

PaginationController.prototype.onBtNext = function() {
    this.currentPage++;
    this.loadPage();
};

PaginationController.prototype.onBtPrevious = function() {
    this.currentPage--;
    this.loadPage();
};

PaginationController.prototype.onBtFirst = function() {
    this.currentPage = 0;
    this.loadPage();
};

PaginationController.prototype.onBtLast = function() {
    this.currentPage = this.totalPages - 1;
    this.loadPage();
};

PaginationController.prototype.isZeroPagesToDisplay = function() {
    return this.foundMaxRow && this.totalPages === 0;
};

PaginationController.prototype.enableOrDisableButtons = function() {
    var disablePreviousAndFirst = this.currentPage === 0;
    this.btPrevious.disabled = disablePreviousAndFirst;
    this.btFirst.disabled = disablePreviousAndFirst;

    var zeroPagesToDisplay = this.isZeroPagesToDisplay();
    var onLastPage = this.foundMaxRow && this.currentPage === (this.totalPages - 1);

    var disableNext = onLastPage || zeroPagesToDisplay;
    this.btNext.disabled = disableNext;

    var disableLast = !this.foundMaxRow || zeroPagesToDisplay || this.currentPage === (this.totalPages - 1);
    this.btLast.disabled = disableLast;
};

PaginationController.prototype.populatePanel = function(ePagingPanel) {

    ePagingPanel.innerHTML = TEMPLATE;

    this.btNext = ePagingPanel.querySelector('#btNext');
    this.btPrevious = ePagingPanel.querySelector('#btPrevious');
    this.btFirst = ePagingPanel.querySelector('#btFirst');
    this.btLast = ePagingPanel.querySelector('#btLast');
    this.lbCurrent = ePagingPanel.querySelector('#current');
    this.lbTotal = ePagingPanel.querySelector('#total');

    this.lbRecordCount = ePagingPanel.querySelector('#recordCount');
    this.lbFirstRowOnPage = ePagingPanel.querySelector('#firstRowOnPage');
    this.lbLastRowOnPage = ePagingPanel.querySelector('#lastRowOnPage');
    this.ePageRowSummaryPanel = ePagingPanel.querySelector('#pageRowSummaryPanel');

    var that = this;

    this.btNext.addEventListener('click', function() {
        that.onBtNext();
    });

    this.btPrevious.addEventListener('click', function() {
        that.onBtPrevious();
    });

    this.btFirst.addEventListener('click', function() {
        that.onBtFirst();
    });

    this.btLast.addEventListener('click', function() {
        that.onBtLast();
    });
};

module.exports = PaginationController;

},{}],20:[function(require,module,exports){
var constants = require('./constants');
var utils = require('./utils');
var groupCellRendererFactory = require('./cellRenderers/groupCellRendererFactory');

var TAB_KEY = 9;
var ENTER_KEY = 13;

var DOWN_KEY = 40;
var UP_KEY = 38;
var LEFT_KEY = 37;
var RIGHT_KEY = 39;

function RowRenderer() {}

RowRenderer.prototype.init = function(gridOptions, columnModel, gridOptionsWrapper, eGrid,
    angularGrid, selectionRendererFactory, $compile, $scope,
    selectionController, expressionService, templateService, eParentOfRows) {
    this.gridOptions = gridOptions;
    this.columnModel = columnModel;
    this.gridOptionsWrapper = gridOptionsWrapper;
    this.angularGrid = angularGrid;
    this.selectionRendererFactory = selectionRendererFactory;
    this.findAllElements(eGrid);
    this.$compile = $compile;
    this.$scope = $scope;
    this.selectionController = selectionController;
    this.expressionService = expressionService;
    this.templateService = templateService;
    this.eParentOfRows = eParentOfRows;

    this.cellRendererMap = {
        'group': groupCellRendererFactory(gridOptionsWrapper, selectionRendererFactory)
    };

    // map of row ids to row objects. keeps track of which elements
    // are rendered for which rows in the dom. each row object has:
    // [scope, bodyRow, pinnedRow, rowData]
    this.renderedRows = {};

    this.renderedRowStartEditingListeners = {};

    this.editingCell = false; //gets set to true when editing a cell
};

RowRenderer.prototype.setRowModel = function(rowModel) {
    this.rowModel = rowModel;
};

RowRenderer.prototype.setMainRowWidths = function() {
    var mainRowWidth = this.columnModel.getBodyContainerWidth() + "px";

    var unpinnedRows = this.eBodyContainer.querySelectorAll(".ag-row");
    for (var i = 0; i < unpinnedRows.length; i++) {
        unpinnedRows[i].style.width = mainRowWidth;
    }
};

RowRenderer.prototype.findAllElements = function(eGrid) {
    if (this.gridOptionsWrapper.isDontUseScrolls()) {
        this.eBodyContainer = eGrid.querySelector(".ag-body-container");
    } else {
        this.eBodyContainer = eGrid.querySelector(".ag-body-container");
        this.eBodyViewport = eGrid.querySelector(".ag-body-viewport");
        this.ePinnedColsContainer = eGrid.querySelector(".ag-pinned-cols-container");
    }
};

RowRenderer.prototype.refreshView = function() {
    if (!this.gridOptionsWrapper.isDontUseScrolls()) {
        var rowCount = this.rowModel.getVirtualRowCount();
        var containerHeight = this.gridOptionsWrapper.getRowHeight() * rowCount;
        this.eBodyContainer.style.height = containerHeight + "px";
        this.ePinnedColsContainer.style.height = containerHeight + "px";
    }

    this.refreshAllVirtualRows();
};

RowRenderer.prototype.softRefreshView = function() {

    var first = this.firstVirtualRenderedRow;
    var last = this.lastVirtualRenderedRow;

    var columns = this.columnModel.getVisibleColumns();
    // if no cols, don't draw row
    if (!columns || columns.length === 0) {
        return;
    }

    for (var rowIndex = first; rowIndex <= last; rowIndex++) {
        var node = this.rowModel.getVirtualRow(rowIndex);
        if (node) {

            for (var colIndex = 0; colIndex <= columns.length; colIndex++) {
                var column = columns[colIndex];
                var renderedRow = this.renderedRows[rowIndex];
                var eGridCell = renderedRow.eVolatileCells[colIndex];

                if (!eGridCell) {
                    continue;
                }

                var isFirstColumn = colIndex === 0;
                var scope = renderedRow.scope;

                this.softRefreshCell(eGridCell, isFirstColumn, node, column, scope, rowIndex);
            }
        }
    }
};

RowRenderer.prototype.softRefreshCell = function(eGridCell, isFirstColumn, node, column, scope, rowIndex) {

    utils.removeAllChildren(eGridCell);

    var data = this.getDataForNode(node);
    var valueGetter = this.createValueGetter(data, column.colDef, node);

    var value;
    if (valueGetter) {
        value = valueGetter();
    }

    this.populateAndStyleGridCell(valueGetter, value, eGridCell, isFirstColumn, node, column, rowIndex, scope);

    // if angular compiling, then need to also compile the cell again (angular compiling sucks, please wait...)
    if (this.gridOptionsWrapper.isAngularCompileRows()) {
        this.$compile(eGridCell)(scope);
    }
};

RowRenderer.prototype.rowDataChanged = function(rows) {
    // we only need to be worried about rendered rows, as this method is
    // called to whats rendered. if the row isn't rendered, we don't care
    var indexesToRemove = [];
    var renderedRows = this.renderedRows;
    Object.keys(renderedRows).forEach(function(key) {
        var renderedRow = renderedRows[key];
        // see if the rendered row is in the list of rows we have to update
        var rowNeedsUpdating = rows.indexOf(renderedRow.node.data) >= 0;
        if (rowNeedsUpdating) {
            indexesToRemove.push(key);
        }
    });
    // remove the rows
    this.removeVirtualRows(indexesToRemove);
    // add draw them again
    this.drawVirtualRows();
};

RowRenderer.prototype.refreshAllVirtualRows = function() {
    // remove all current virtual rows, as they have old data
    var rowsToRemove = Object.keys(this.renderedRows);
    this.removeVirtualRows(rowsToRemove);

    // add in new rows
    this.drawVirtualRows();
};

// public - removes the group rows and then redraws them again
RowRenderer.prototype.refreshGroupRows = function() {
    // find all the group rows
    var rowsToRemove = [];
    var that = this;
    Object.keys(this.renderedRows).forEach(function(key) {
        var renderedRow = that.renderedRows[key];
        var node = renderedRow.node;
        if (node.group) {
            rowsToRemove.push(key);
        }
    });
    // remove the rows
    this.removeVirtualRows(rowsToRemove);
    // and draw them back again
    this.ensureRowsRendered();
};

// takes array of row indexes
RowRenderer.prototype.removeVirtualRows = function(rowsToRemove) {
    var that = this;
    rowsToRemove.forEach(function(indexToRemove) {
        that.removeVirtualRow(indexToRemove);
    });
};

RowRenderer.prototype.removeVirtualRow = function(indexToRemove) {
    var renderedRow = this.renderedRows[indexToRemove];
    if (renderedRow.pinnedElement && this.ePinnedColsContainer) {
        this.ePinnedColsContainer.removeChild(renderedRow.pinnedElement);
    }

    if (renderedRow.bodyElement) {
        this.eBodyContainer.removeChild(renderedRow.bodyElement);
    }

    if (renderedRow.scope) {
        renderedRow.scope.$destroy();
    }

    if (this.gridOptionsWrapper.getVirtualRowRemoved()) {
        this.gridOptionsWrapper.getVirtualRowRemoved()(renderedRow.data, indexToRemove);
    }
    this.angularGrid.onVirtualRowRemoved(indexToRemove);

    delete this.renderedRows[indexToRemove];
    delete this.renderedRowStartEditingListeners[indexToRemove];
};

RowRenderer.prototype.drawVirtualRows = function() {
    var first;
    var last;

    var rowCount = this.rowModel.getVirtualRowCount();

    if (this.gridOptionsWrapper.isDontUseScrolls()) {
        first = 0;
        last = rowCount;
    } else {
        var topPixel = this.eBodyViewport.scrollTop;
        var bottomPixel = topPixel + this.eBodyViewport.offsetHeight;

        first = Math.floor(topPixel / this.gridOptionsWrapper.getRowHeight());
        last = Math.floor(bottomPixel / this.gridOptionsWrapper.getRowHeight());

        //add in buffer
        var buffer = this.gridOptionsWrapper.getRowBuffer() || constants.ROW_BUFFER_SIZE;
        first = first - buffer;
        last = last + buffer;

        // adjust, in case buffer extended actual size
        if (first < 0) {
            first = 0;
        }
        if (last > rowCount - 1) {
            last = rowCount - 1;
        }
    }

    this.firstVirtualRenderedRow = first;
    this.lastVirtualRenderedRow = last;

    this.ensureRowsRendered();
};

RowRenderer.prototype.getFirstVirtualRenderedRow = function() {
    return this.firstVirtualRenderedRow;
};

RowRenderer.prototype.getLastVirtualRenderedRow = function() {
    return this.lastVirtualRenderedRow;
};

RowRenderer.prototype.ensureRowsRendered = function() {

    var mainRowWidth = this.columnModel.getBodyContainerWidth();
    var that = this;

    // at the end, this array will contain the items we need to remove
    var rowsToRemove = Object.keys(this.renderedRows);

    // add in new rows
    for (var rowIndex = this.firstVirtualRenderedRow; rowIndex <= this.lastVirtualRenderedRow; rowIndex++) {
        // see if item already there, and if yes, take it out of the 'to remove' array
        if (rowsToRemove.indexOf(rowIndex.toString()) >= 0) {
            rowsToRemove.splice(rowsToRemove.indexOf(rowIndex.toString()), 1);
            continue;
        }
        // check this row actually exists (in case overflow buffer window exceeds real data)
        var node = this.rowModel.getVirtualRow(rowIndex);
        if (node) {
            that.insertRow(node, rowIndex, mainRowWidth);
        }
    }

    // at this point, everything in our 'rowsToRemove' . . .
    this.removeVirtualRows(rowsToRemove);

    // if we are doing angular compiling, then do digest the scope here
    if (this.gridOptionsWrapper.isAngularCompileRows()) {
        // we do it in a timeout, in case we are already in an apply
        setTimeout(function() {
            that.$scope.$apply();
        }, 0);
    }
};

RowRenderer.prototype.insertRow = function(node, rowIndex, mainRowWidth) {
    var columns = this.columnModel.getVisibleColumns();
    // if no cols, don't draw row
    if (!columns || columns.length == 0) {
        return;
    }

    // var rowData = node.rowData;
    var rowIsAGroup = node.group;
    var rowIsAFooter = node.footer;

    // try compiling as we insert rows
    var newChildScope = this.createChildScopeOrNull(node.data);

    var ePinnedRow = this.createRowContainer(rowIndex, node, rowIsAGroup, newChildScope);
    var eMainRow = this.createRowContainer(rowIndex, node, rowIsAGroup, newChildScope);
    var that = this;

    eMainRow.style.width = mainRowWidth + "px";

    var renderedRow = {
        scope: newChildScope,
        node: node,
        rowIndex: rowIndex,
        eCells: {},
        eVolatileCells: {}
    };
    this.renderedRows[rowIndex] = renderedRow;
    this.renderedRowStartEditingListeners[rowIndex] = {};

    // if group item, insert the first row
    var groupHeaderTakesEntireRow = this.gridOptionsWrapper.isGroupUseEntireRow();
    var drawGroupRow = rowIsAGroup && groupHeaderTakesEntireRow;

    if (drawGroupRow) {
        var firstColumn = columns[0];

        var eGroupRow = that.createGroupElement(node, false);
        if (firstColumn.pinned) {
            ePinnedRow.appendChild(eGroupRow);

            var eGroupRowPadding = that.createGroupElement(node, true);
            eMainRow.appendChild(eGroupRowPadding);
        } else {
            eMainRow.appendChild(eGroupRow);
        }

        //renderedRow.eCells[firstColumn.colKey] = eGroupRow;

    } else {

        columns.forEach(function(column, index) {
            var firstCol = index === 0;
            var data = that.getDataForNode(node);
            var valueGetter = that.createValueGetter(data, column.colDef, node);
            that.createCellFromColDef(firstCol, column, valueGetter, node, rowIndex, eMainRow, ePinnedRow, newChildScope, renderedRow);
        });
    }

    //try compiling as we insert rows
    renderedRow.pinnedElement = this.compileAndAdd(this.ePinnedColsContainer, rowIndex, ePinnedRow, newChildScope);
    renderedRow.bodyElement = this.compileAndAdd(this.eBodyContainer, rowIndex, eMainRow, newChildScope);
};

// if group is a footer, always show the data.
// if group is a header, only show data if not expanded
RowRenderer.prototype.getDataForNode = function(node) {
    if (node.footer) {
        // if footer, we always show the data
        return node.data;
    } else if (node.group) {
        // if header and header is expanded, we show data in footer only
        var footersEnabled = this.gridOptionsWrapper.isGroupIncludeFooter();
        return (node.expanded && footersEnabled) ? undefined : node.data;
    } else {
        // otherwise it's a normal node, just return data as normal
        return node.data;
    }
};

RowRenderer.prototype.createValueGetter = function(data, colDef, node) {
    var that = this;
    return function() {
        var api = that.gridOptionsWrapper.getApi();
        var context = that.gridOptionsWrapper.getContext();
        return utils.getValue(that.expressionService, data, colDef, node, api, context);
    };
};

RowRenderer.prototype.createChildScopeOrNull = function(data) {
    if (this.gridOptionsWrapper.isAngularCompileRows()) {
        var newChildScope = this.$scope.$new();
        newChildScope.data = data;
        return newChildScope;
    } else {
        return null;
    }
};

RowRenderer.prototype.compileAndAdd = function(container, rowIndex, element, scope) {
    if (scope) {
        var eElementCompiled = this.$compile(element)(scope);
        if (container) { // checking container, as if noScroll, pinned container is missing
            container.appendChild(eElementCompiled[0]);
        }
        return eElementCompiled[0];
    } else {
        if (container) {
            container.appendChild(element);
        }
        return element;
    }
};

RowRenderer.prototype.createCellFromColDef = function(isFirstColumn, column, valueGetter, node, rowIndex, eMainRow, ePinnedRow, $childScope, renderedRow) {
    var eGridCell = this.createCell(isFirstColumn, column, valueGetter, node, rowIndex, $childScope);

    if (column.colDef.volatile) {
        renderedRow.eVolatileCells[column.colKey] = eGridCell;
    }
    renderedRow.eCells[column.colKey] = eGridCell;

    if (column.pinned) {
        ePinnedRow.appendChild(eGridCell);
    } else {
        eMainRow.appendChild(eGridCell);
    }
};

RowRenderer.prototype.addClassesToRow = function(rowIndex, node, eRow) {
    var classesList = ["ag-row"];
    classesList.push(rowIndex % 2 == 0 ? "ag-row-even" : "ag-row-odd");

    if (this.selectionController.isNodeSelected(node)) {
        classesList.push("ag-row-selected");
    }
    if (node.group) {
        // if a group, put the level of the group in
        classesList.push("ag-row-level-" + node.level);
    } else {
        // if a leaf, and a parent exists, put a level of the parent, else put level of 0 for top level item
        if (node.parent) {
            classesList.push("ag-row-level-" + (node.parent.level + 1));
        } else {
            classesList.push("ag-row-level-0");
        }
    }
    if (node.group) {
        classesList.push("ag-row-group");
    }
    if (node.group && !node.footer && node.expanded) {
        classesList.push("ag-row-group-expanded");
    }
    if (node.group && !node.footer && !node.expanded) {
        // opposite of expanded is contracted according to the internet.
        classesList.push("ag-row-group-contracted");
    }
    if (node.group && node.footer) {
        classesList.push("ag-row-footer");
    }

    // add in extra classes provided by the config
    if (this.gridOptionsWrapper.getRowClass()) {
        var params = {
            node: node,
            data: node.data,
            rowIndex: rowIndex,
            context: this.gridOptionsWrapper.getContext(),
            api: this.gridOptionsWrapper.getApi()
        };
        var extraRowClasses = this.gridOptionsWrapper.getRowClass()(params);
        if (extraRowClasses) {
            if (typeof extraRowClasses === 'string') {
                classesList.push(extraRowClasses);
            } else if (Array.isArray(extraRowClasses)) {
                extraRowClasses.forEach(function(classItem) {
                    classesList.push(classItem);
                });
            }
        }
    }

    var classes = classesList.join(" ");

    eRow.className = classes;
};

RowRenderer.prototype.createRowContainer = function(rowIndex, node, groupRow, $scope) {
    var eRow = document.createElement("div");

    this.addClassesToRow(rowIndex, node, eRow);

    eRow.setAttribute('row', rowIndex);

    // if showing scrolls, position on the container
    if (!this.gridOptionsWrapper.isDontUseScrolls()) {
        eRow.style.top = (this.gridOptionsWrapper.getRowHeight() * rowIndex) + "px";
    }
    eRow.style.height = (this.gridOptionsWrapper.getRowHeight()) + "px";

    if (this.gridOptionsWrapper.getRowStyle()) {
        var cssToUse;
        var rowStyle = this.gridOptionsWrapper.getRowStyle();
        if (typeof rowStyle === 'function') {
            var params = {
                data: node.data,
                node: node,
                api: this.gridOptionsWrapper.getApi(),
                context: this.gridOptionsWrapper.getContext(),
                $scope: $scope
            };
            cssToUse = rowStyle(params);
        } else {
            cssToUse = rowStyle;
        }

        if (cssToUse) {
            Object.keys(cssToUse).forEach(function(key) {
                eRow.style[key] = cssToUse[key];
            });
        }
    }

    var _this = this;
    eRow.addEventListener("click", function(event) {
        _this.angularGrid.onRowClicked(event, Number(this.getAttribute("row")), node)
    });

    return eRow;
};

RowRenderer.prototype.getIndexOfRenderedNode = function(node) {
    var renderedRows = this.renderedRows;
    var keys = Object.keys(renderedRows);
    for (var i = 0; i < keys.length; i++) {
        if (renderedRows[keys[i]].node === node) {
            return renderedRows[keys[i]].rowIndex;
        }
    }
    return -1;
};

RowRenderer.prototype.createGroupElement = function(node, padding) {
    var eRow;
    if (padding) {
        eRow = document.createElement('span');
    } else {
        var params = {
            node: node,
            data: node.data,
            rowIndex: 4,
            api: this.gridOptionsWrapper.getApi(),
            colDef: {
                cellRenderer: {
                    renderer: 'group',
                    innerRenderer: this.gridOptionsWrapper.getGroupInnerRenderer()
                }
            }
        };
        eRow = this.cellRendererMap['group'](params);
    }

    if (node.footer) {
        utils.addCssClass(eRow, 'ag-footer-cell-entire-row');
    } else {
        utils.addCssClass(eRow, 'ag-group-cell-entire-row');
    }

    return eRow;
};

RowRenderer.prototype.putDataIntoCell = function(column, value, valueGetter, node, $childScope, eGridCell, rowIndex, refreshCellFunction) {
    // template gets preference, then cellRenderer, then do it ourselves
    var colDef = column.colDef;
    if (colDef.template) {
        eGridCell.innerHTML = colDef.template;
    } else if (colDef.templateUrl) {
        var template = this.templateService.getTemplate(colDef.templateUrl, refreshCellFunction);
        if (template) {
            eGridCell.innerHTML = template;
        }
    } else if (colDef.cellRenderer) {
        this.useCellRenderer(column, value, node, $childScope, eGridCell, rowIndex, refreshCellFunction, valueGetter);
    } else {
        // if we insert undefined, then it displays as the string 'undefined', ugly!
        if (value !== undefined && value !== null && value !== '') {
            eGridCell.innerHTML = value;
        }
    }
};

RowRenderer.prototype.useCellRenderer = function(column, value, node, $childScope, eGridCell, rowIndex, refreshCellFunction, valueGetter) {
    var colDef = column.colDef;
    var rendererParams = {
        value: value,
        valueGetter: valueGetter,
        data: node.data,
        node: node,
        colDef: colDef,
        column: column,
        $scope: $childScope,
        rowIndex: rowIndex,
        api: this.gridOptionsWrapper.getApi(),
        context: this.gridOptionsWrapper.getContext(),
        refreshCell: refreshCellFunction
    };
    var cellRenderer;
    if (typeof colDef.cellRenderer === 'object') {
        cellRenderer = this.cellRendererMap[colDef.cellRenderer.renderer];
        if (!cellRenderer) {
            throw 'Cell renderer ' + colDef.cellRenderer + ' not found, available are ' + Object.keys(this.cellRendererMap);
        }
    } else if (typeof colDef.cellRenderer === 'function') {
        cellRenderer = colDef.cellRenderer;
    } else {
        throw 'Cell Renderer must be String or Function';
    }
    var resultFromRenderer = cellRenderer(rendererParams);
    if (utils.isNodeOrElement(resultFromRenderer)) {
        // a dom node or element was returned, so add child
        eGridCell.appendChild(resultFromRenderer);
    } else {
        // otherwise assume it was html, so just insert
        eGridCell.innerHTML = resultFromRenderer;
    }
};

RowRenderer.prototype.addStylesFromCollDef = function(column, value, node, $childScope, eGridCell) {
    var colDef = column.colDef;
    if (colDef.cellStyle) {
        var cssToUse;
        if (typeof colDef.cellStyle === 'function') {
            var cellStyleParams = {
                value: value,
                data: node.data,
                node: node,
                colDef: colDef,
                column: column,
                $scope: $childScope,
                context: this.gridOptionsWrapper.getContext(),
                api: this.gridOptionsWrapper.getApi()
            };
            cssToUse = colDef.cellStyle(cellStyleParams);
        } else {
            cssToUse = colDef.cellStyle;
        }

        if (cssToUse) {
            Object.keys(cssToUse).forEach(function(key) {
                eGridCell.style[key] = cssToUse[key];
            });
        }
    }
};

RowRenderer.prototype.addClassesFromCollDef = function(colDef, value, node, $childScope, eGridCell) {
    if (colDef.cellClass) {
        var classToUse;
        if (typeof colDef.cellClass === 'function') {
            var cellClassParams = {
                value: value,
                data: node.data,
                node: node,
                colDef: colDef,
                $scope: $childScope,
                context: this.gridOptionsWrapper.getContext(),
                api: this.gridOptionsWrapper.getApi()
            };
            classToUse = colDef.cellClass(cellClassParams);
        } else {
            classToUse = colDef.cellClass;
        }

        if (typeof classToUse === 'string') {
            utils.addCssClass(eGridCell, classToUse);
        } else if (Array.isArray(classToUse)) {
            classToUse.forEach(function(cssClassItem) {
                utils.addCssClass(eGridCell, cssClassItem);
            });
        }
    }
};

RowRenderer.prototype.addClassesToCell = function(column, node, eGridCell) {
    var classes = ['ag-cell', 'ag-cell-no-focus', 'cell-col-' + column.index];
    if (node.group) {
        if (node.footer) {
            classes.push('ag-footer-cell');
        } else {
            classes.push('ag-group-cell');
        }
    }
    eGridCell.className = classes.join(' ');
};

RowRenderer.prototype.addClassesFromRules = function(colDef, eGridCell, value, node, rowIndex) {
    var classRules = colDef.cellClassRules;
    if (typeof classRules === 'object') {

        var params = {
            value: value,
            data: node.data,
            node: node,
            colDef: colDef,
            rowIndex: rowIndex,
            api: this.gridOptionsWrapper.getApi(),
            context: this.gridOptionsWrapper.getContext()
        };

        var classNames = Object.keys(classRules);
        for (var i = 0; i < classNames.length; i++) {
            var className = classNames[i];
            var rule = classRules[className];
            var resultOfRule;
            if (typeof rule === 'string') {
                resultOfRule = this.expressionService.evaluate(rule, params);
            } else if (typeof rule === 'function') {
                resultOfRule = rule(params);
            }
            if (resultOfRule) {
                utils.addCssClass(eGridCell, className);
            } else {
                utils.removeCssClass(eGridCell, className);
            }
        }
    }
};

RowRenderer.prototype.createCell = function(isFirstColumn, column, valueGetter, node, rowIndex, $childScope) {
    var that = this;
    var eGridCell = document.createElement("div");
    eGridCell.setAttribute("col", column.index);

    eGridCell.setAttribute("tabindex", "-1");

    var value;
    if (valueGetter) {
        value = valueGetter();
    }

    // these are the grid styles, don't change between soft refreshes
    this.addClassesToCell(column, node, eGridCell);

    this.populateAndStyleGridCell(valueGetter, value, eGridCell, isFirstColumn, node, column, rowIndex, $childScope);

    this.addCellClickedHandler(eGridCell, node, column, value, rowIndex);
    this.addCellDoubleClickedHandler(eGridCell, node, column, value, rowIndex, $childScope, isFirstColumn, valueGetter);

    this.addCellNavigationHandler(eGridCell, rowIndex, column);

    eGridCell.style.width = utils.formatWidth(column.actualWidth);

    // add the 'start editing' call to the chain of editors
    this.renderedRowStartEditingListeners[rowIndex][column.index] = function() {
        if (that.isCellEditable(column.colDef, node)) {
            that.startEditing(eGridCell, column, node, $childScope, rowIndex, isFirstColumn, valueGetter);
            return true;
        } else {
            return false;
        }
    };

    return eGridCell;
};

RowRenderer.prototype.addCellNavigationHandler = function(eGridCell, rowIndex, column) {
    var that = this;
    eGridCell.addEventListener('keydown', function(event) {
        var key = event.which || event.keyCode;
        if (key === DOWN_KEY || key === UP_KEY || key === LEFT_KEY || key === RIGHT_KEY) {
            event.preventDefault();
            that.navigateToNextCell(key, rowIndex, column);
        }
    });
};

RowRenderer.prototype.navigateToNextCell = function(key, rowIndex, column) {

    var rowToFocus;
    var colToFocus;

    switch (key) {
        case UP_KEY :
            // if already on top row, do nothing
            if (rowIndex === this.firstVirtualRenderedRow) {
                return;
            }
            rowToFocus = rowIndex - 1;
            colToFocus = column.index;
            break;
        case DOWN_KEY :
            // if already on bottom, do nothing
            if (rowIndex === this.lastVirtualRenderedRow) {
                return;
            }
            rowToFocus = rowIndex + 1;
            colToFocus = column.index;
            break;
        case RIGHT_KEY :
            var colToRight = this.columnModel.getVisibleColAfter(column);
            // if already on right, do nothing
            if (!colToRight) {
                return;
            }
            rowToFocus = rowIndex ;
            colToFocus = colToRight.index;
            break;
        case LEFT_KEY :
            var colToLeft = this.columnModel.getVisibleColBefore(column);
            // if already on right, do nothing
            if (!colToLeft) {
                return;
            }
            rowToFocus = rowIndex ;
            colToFocus = colToLeft.index;
            break;
    }

    var renderedRow = this.renderedRows[rowToFocus];
    var eCell = renderedRow.eCells[colToFocus];

    // this scrolls the row into view
    this.angularGrid.ensureIndexVisible(renderedRow.rowIndex);

    // this changes the css on the cell
    this.focusCell(rowToFocus, colToFocus);
    // this puts the browser focus on the cell (so it gets key presses)
    eCell.focus();
};

RowRenderer.prototype.focusCell = function(rowIndex, colIndex) {
    // remove any previous focus
    utils.querySelectorAll_replaceCssClass(this.eParentOfRows, '.ag-cell-focus', 'ag-cell-focus', 'ag-cell-no-focus');

    var selectorForCell = '[row="' + rowIndex + '"] [col="' + colIndex + '"]';
    utils.querySelectorAll_replaceCssClass(this.eParentOfRows, selectorForCell, 'ag-cell-no-focus', 'ag-cell-focus');
};

RowRenderer.prototype.populateAndStyleGridCell = function(valueGetter, value, eGridCell, isFirstColumn, node, column, rowIndex, $childScope) {
    var colDef = column.colDef;

    // populate
    this.populateGridCell(eGridCell, isFirstColumn, node, column, rowIndex, value, valueGetter, $childScope);
    // style
    this.addStylesFromCollDef(column, value, node, $childScope, eGridCell);
    this.addClassesFromCollDef(colDef, value, node, $childScope, eGridCell);
    this.addClassesFromRules(colDef, eGridCell, value, node, rowIndex);
};

RowRenderer.prototype.populateGridCell = function(eGridCell, isFirstColumn, node, column, rowIndex, value, valueGetter, $childScope) {
    var eCellWrapper = document.createElement('span');
    eGridCell.appendChild(eCellWrapper);

    var colDef = column.colDef;
    if (colDef.checkboxSelection) {
        var eCheckbox = this.selectionRendererFactory.createSelectionCheckbox(node, rowIndex);
        eCellWrapper.appendChild(eCheckbox);
    }

    var eSpanWithValue = document.createElement("span");
    eCellWrapper.appendChild(eSpanWithValue);

    var that = this;
    var refreshCellFunction = function() {
        that.softRefreshCell(eGridCell, isFirstColumn, node, column, $childScope, rowIndex);
    };

    this.putDataIntoCell(column, value, valueGetter, node, $childScope, eSpanWithValue, rowIndex, refreshCellFunction);
};

RowRenderer.prototype.addCellDoubleClickedHandler = function(eGridCell, node, column, value, rowIndex, $childScope, isFirstColumn, valueGetter) {
    var that = this;
    var colDef = column.colDef;
    eGridCell.addEventListener("dblclick", function(event) {
        if (that.gridOptionsWrapper.getCellDoubleClicked()) {
            var paramsForGrid = {
                node: node,
                data: node.data,
                value: value,
                rowIndex: rowIndex,
                colDef: colDef,
                event: event,
                eventSource: this,
                api: that.gridOptionsWrapper.getApi()
            };
            that.gridOptionsWrapper.getCellDoubleClicked()(paramsForGrid);
        }
        if (colDef.cellDoubleClicked) {
            var paramsForColDef = {
                node: node,
                data: node.data,
                value: value,
                rowIndex: rowIndex,
                colDef: colDef,
                event: event,
                eventSource: this,
                api: that.gridOptionsWrapper.getApi()
            };
            colDef.cellDoubleClicked(paramsForColDef);
        }
        if (that.isCellEditable(colDef, node)) {
            that.startEditing(eGridCell, column, node, $childScope, rowIndex, isFirstColumn, valueGetter);
        }
    });
};

RowRenderer.prototype.addCellClickedHandler = function(eGridCell, node, column, value, rowIndex) {
    var colDef = column.colDef;
    var that = this;
    eGridCell.addEventListener("click", function(event) {
        //that.focusCell(rowIndex, column.index);
        if (that.gridOptionsWrapper.getCellClicked()) {
            var paramsForGrid = {
                node: node,
                data: node.data,
                value: value,
                rowIndex: rowIndex,
                colDef: colDef,
                event: event,
                eventSource: this,
                api: that.gridOptionsWrapper.getApi()
            };
            that.gridOptionsWrapper.getCellClicked()(paramsForGrid);
        }
        if (colDef.cellClicked) {
            var paramsForColDef = {
                node: node,
                data: node.data,
                value: value,
                rowIndex: rowIndex,
                colDef: colDef,
                event: event,
                eventSource: this,
                api: that.gridOptionsWrapper.getApi()
            };
            colDef.cellClicked(paramsForColDef);
        }
    });
};

RowRenderer.prototype.isCellEditable = function(colDef, node) {
    if (this.editingCell) {
        return false;
    }

    // never allow editing of groups
    if (node.group) {
        return false;
    }

    // if boolean set, then just use it
    if (typeof colDef.editable === 'boolean') {
        return colDef.editable;
    }

    // if function, then call the function to find out
    if (typeof colDef.editable === 'function') {
        // should change this, so it gets passed params with nice useful values
        return colDef.editable(node.data);
    }

    return false;
};

RowRenderer.prototype.stopEditing = function(eGridCell, column, node, $childScope, eInput, blurListener, rowIndex, isFirstColumn, valueGetter) {
    this.editingCell = false;
    var newValue = eInput.value;
    var colDef = column.colDef;

    //If we don't remove the blur listener first, we get:
    //Uncaught NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is no longer a child of this node. Perhaps it was moved in a 'blur' event handler?
    eInput.removeEventListener('blur', blurListener);

    utils.removeAllChildren(eGridCell);

    var paramsForCallbacks = {
        node: node,
        data: node.data,
        oldValue: node.data[colDef.field],
        newValue: newValue,
        rowIndex: rowIndex,
        colDef: colDef,
        api: this.gridOptionsWrapper.getApi(),
        context: this.gridOptionsWrapper.getContext()
    };

    if (colDef.newValueHandler) {
        colDef.newValueHandler(paramsForCallbacks);
    } else {
        node.data[colDef.field] = newValue;
    }

    // at this point, the value has been updated
    var newValue;
    if (valueGetter) {
        newValue = valueGetter();
    }
    paramsForCallbacks.newValue = newValue;
    if (typeof colDef.cellValueChanged === 'function') {
        colDef.cellValueChanged(paramsForCallbacks);
    }
    if (typeof this.gridOptionsWrapper.getCellValueChanged() === 'function') {
        this.gridOptionsWrapper.getCellValueChanged()(paramsForCallbacks);
    }

    this.populateAndStyleGridCell(valueGetter, newValue, eGridCell, isFirstColumn, node, column, rowIndex, $childScope);
};

RowRenderer.prototype.startEditing = function(eGridCell, column, node, $childScope, rowIndex, isFirstColumn, valueGetter) {
    var that = this;
    this.editingCell = true;
    utils.removeAllChildren(eGridCell);
    var eInput = document.createElement('input');
    eInput.type = 'text';
    utils.addCssClass(eInput, 'ag-cell-edit-input');

    if (valueGetter) {
        var value = valueGetter();
        if (value !== null && value !== undefined) {
            eInput.value = value;
        }
    }

    eInput.style.width = (column.actualWidth - 14) + 'px';
    eGridCell.appendChild(eInput);
    eInput.focus();
    eInput.select();

    var blurListener = function() {
        that.stopEditing(eGridCell, column, node, $childScope, eInput, blurListener, rowIndex, isFirstColumn, valueGetter);
    };

    //stop entering if we loose focus
    eInput.addEventListener("blur", blurListener);

    //stop editing if enter pressed
    eInput.addEventListener('keypress', function(event) {
        var key = event.which || event.keyCode;
        // 13 is enter
        if (key == ENTER_KEY) {
            that.stopEditing(eGridCell, column, node, $childScope, eInput, blurListener, rowIndex, isFirstColumn, valueGetter);
        }
    });

    // tab key doesn't generate keypress, so need keydown to listen for that
    eInput.addEventListener('keydown', function(event) {
        var key = event.which || event.keyCode;
        if (key == TAB_KEY) {
            that.stopEditing(eGridCell, column, node, $childScope, eInput, blurListener, rowIndex, isFirstColumn, valueGetter);
            that.startEditingNextCell(rowIndex, column, event.shiftKey);
            // we don't want the default tab action, so return false, this stops the event from bubbling
            event.preventDefault();
            return false;
        }
    });
};

RowRenderer.prototype.startEditingNextCell = function(rowIndex, column, shiftKey) {

    var firstRowToCheck = this.firstVirtualRenderedRow;
    var lastRowToCheck = this.lastVirtualRenderedRow;
    var currentRowIndex = rowIndex;

    var visibleColumns = this.columnModel.getVisibleColumns();
    var currentCol = column;

    while (true) {

        var indexOfCurrentCol = visibleColumns.indexOf(currentCol);

        // move backward
        if (shiftKey) {
            // move along to the previous cell
            currentCol = visibleColumns[indexOfCurrentCol - 1];
            // check if end of the row, and if so, go back a row
            if (!currentCol) {
                currentCol = visibleColumns[visibleColumns.length - 1];
                currentRowIndex--;
            }

            // if got to end of rendered rows, then quit looking
            if (currentRowIndex < firstRowToCheck) {
                return;
            }
            // move forward
        } else {
            // move along to the next cell
            currentCol = visibleColumns[indexOfCurrentCol + 1];
            // check if end of the row, and if so, go forward a row
            if (!currentCol) {
                currentCol = visibleColumns[0];
                currentRowIndex++;
            }

            // if got to end of rendered rows, then quit looking
            if (currentRowIndex > lastRowToCheck) {
                return;
            }
        }

        var nextFunc = this.renderedRowStartEditingListeners[currentRowIndex][currentCol.colKey];
        if (nextFunc) {
            // see if the next cell is editable, and if so, we have come to
            // the end of our search, so stop looking for the next cell
            var nextCellAcceptedEdit = nextFunc();
            if (nextCellAcceptedEdit) {
                return;
            }
        }
    }

};

module.exports = RowRenderer;

},{"./cellRenderers/groupCellRendererFactory":1,"./constants":3,"./utils":27}],21:[function(require,module,exports){
var utils = require('./utils');

// these constants are used for determining if groups should
// be selected or deselected when selecting groups, and the group
// then selects the children.
var SELECTED = 0;
var UNSELECTED = 1;
var MIXED = 2;
var DO_NOT_CARE = 3;

function SelectionController() {}

SelectionController.prototype.init = function(angularGrid, eRowsParent, gridOptionsWrapper, $scope, rowRenderer) {
    this.eRowsParent = eRowsParent;
    this.angularGrid = angularGrid;
    this.gridOptionsWrapper = gridOptionsWrapper;
    this.$scope = $scope;
    this.rowRenderer = rowRenderer;

    this.selectedNodesById = {};
    this.selectedRows = [];

    gridOptionsWrapper.setSelectedRows(this.selectedRows);
    gridOptionsWrapper.setSelectedNodesById(this.selectedNodesById);
};

SelectionController.prototype.getSelectedNodes = function() {
    var selectedNodes = [];
    var keys = Object.keys(this.selectedNodesById);
    for (var i = 0; i < keys.length; i++) {
        var id = keys[i];
        var selectedNode = this.selectedNodesById[id];
        selectedNodes.push(selectedNode);
    }
    return selectedNodes;
};

// returns a list of all nodes at 'best cost' - a feature to be used
// with groups / trees. if a group has all it's children selected,
// then the group appears in the result, but not the children.
// Designed for use with 'children' as the group selection type,
// where groups don't actually appear in the selection normally.
SelectionController.prototype.getBestCostNodeSelection = function() {

    if (typeof this.rowModel.getTopLevelNodes !== 'function') {
        throw 'selectAll not available when rows are on the server';
    }

    var topLevelNodes = this.rowModel.getTopLevelNodes();

    var result = [];
    var that = this;

    // recursive function, to find the selected nodes
    function traverse(nodes) {
        for (var i = 0, l = nodes.length; i < l; i++) {
            var node = nodes[i];
            if (that.isNodeSelected(node)) {
                result.push(node);
            } else {
                // if not selected, then if it's a group, and the group
                // has children, continue to search for selections
                if (node.group && node.children) {
                    traverse(node.children);
                }
            }
        }
    }

    traverse(topLevelNodes);

    return result;
};

SelectionController.prototype.setRowModel = function(rowModel) {
    this.rowModel = rowModel;
};

// public - this clears the selection, but doesn't clear down the css - when it is called, the
// caller then gets the grid to refresh.
SelectionController.prototype.deselectAll = function() {
    this.selectedRows.length = 0;
    var keys = Object.keys(this.selectedNodesById);
    for (var i = 0; i < keys.length; i++) {
        delete this.selectedNodesById[keys[i]];
    }
    this.syncSelectedRowsAndCallListener();
};

// public - this selects everything, but doesn't clear down the css - when it is called, the
// caller then gets the grid to refresh.
SelectionController.prototype.selectAll = function() {

    if (typeof this.rowModel.getTopLevelNodes !== 'function') {
        throw 'selectAll not available when rows are on the server';
    }

    var selectedNodesById = this.selectedNodesById;
    // if the selection is "don't include groups", then we don't include them!
    var includeGroups = !this.gridOptionsWrapper.isGroupSelectsChildren();

    function recursivelySelect(nodes) {
        if (nodes) {
            for (var i = 0; i<nodes.length; i++) {
                var node = nodes[i];
                if (node.group) {
                    recursivelySelect(node.children);
                    if (includeGroups) {
                        selectedNodesById[node.id] = node;
                    }
                } else {
                    selectedNodesById[node.id] = node;
                }
            }
        }
    }

    var topLevelNodes = this.rowModel.getTopLevelNodes();
    recursivelySelect(topLevelNodes);

    this.syncSelectedRowsAndCallListener();
};

// public
SelectionController.prototype.selectNode = function(node, tryMulti, suppressEvents) {
    var multiSelect = this.gridOptionsWrapper.isRowSelectionMulti() && tryMulti;

    // if the node is a group, then selecting this is the same as selecting the parent,
    // so to have only one flow through the below, we always select the header parent
    // (which then has the side effect of selecting the child).
    var nodeToSelect;
    if (node.footer) {
        nodeToSelect = node.sibling;
    } else {
        nodeToSelect = node;
    }

    // at the end, if this is true, we inform the callback
    var atLeastOneItemUnselected = false;
    var atLeastOneItemSelected = false;

    // see if rows to be deselected
    if (!multiSelect) {
        atLeastOneItemUnselected = this.doWorkOfDeselectAllNodes();
    }

    if (this.gridOptionsWrapper.isGroupSelectsChildren() && nodeToSelect.group) {
        // don't select the group, select the children instead
        atLeastOneItemSelected = this.recursivelySelectAllChildren(nodeToSelect);
    } else {
        // see if row needs to be selected
        atLeastOneItemSelected = this.doWorkOfSelectNode(nodeToSelect, suppressEvents);
    }

    if (atLeastOneItemUnselected || atLeastOneItemSelected) {
        this.syncSelectedRowsAndCallListener(suppressEvents);
    }

    this.updateGroupParentsIfNeeded();
};

SelectionController.prototype.recursivelySelectAllChildren = function(node, suppressEvents) {
    var atLeastOne = false;
    if (node.children) {
        for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            if (child.group) {
                if (this.recursivelySelectAllChildren(child)) {
                    atLeastOne = true;
                }
            } else {
                if (this.doWorkOfSelectNode(child, suppressEvents)) {
                    atLeastOne = true;
                }
            }
        }
    }
    return atLeastOne;
};

SelectionController.prototype.recursivelyDeselectAllChildren = function(node) {
    if (node.children) {
        for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            if (child.group) {
                this.recursivelyDeselectAllChildren(child);
            } else {
                this.deselectRealNode(child);
            }
        }
    }
};

// private
// 1 - selects a node
// 2 - updates the UI
// 3 - calls callbacks
SelectionController.prototype.doWorkOfSelectNode = function(node, suppressEvents) {
    if (this.selectedNodesById[node.id]) {
        return false;
    }

    this.selectedNodesById[node.id] = node;

    this.addCssClassForNode_andInformVirtualRowListener(node);

    // also color in the footer if there is one
    if (node.group && node.expanded && node.sibling) {
        this.addCssClassForNode_andInformVirtualRowListener(node.sibling);
    }

    // inform the rowSelected listener, if any
    if (!suppressEvents && typeof this.gridOptionsWrapper.getRowSelected() === "function") {
        this.gridOptionsWrapper.getRowSelected()(node.data, node);
    }

    return true;
};

// private
// 1 - selects a node
// 2 - updates the UI
// 3 - calls callbacks
// wow - what a big name for a method, exception case, it's saying what the method does
SelectionController.prototype.addCssClassForNode_andInformVirtualRowListener = function(node) {
    var virtualRenderedRowIndex = this.rowRenderer.getIndexOfRenderedNode(node);
    if (virtualRenderedRowIndex >= 0) {
        utils.querySelectorAll_addCssClass(this.eRowsParent, '[row="' + virtualRenderedRowIndex + '"]', 'ag-row-selected');

        // inform virtual row listener
        this.angularGrid.onVirtualRowSelected(virtualRenderedRowIndex, true);
    }
};

// private
// 1 - un-selects a node
// 2 - updates the UI
// 3 - calls callbacks
SelectionController.prototype.doWorkOfDeselectAllNodes = function(nodeToKeepSelected) {
    // not doing multi-select, so deselect everything other than the 'just selected' row
    var atLeastOneSelectionChange;
    var selectedNodeKeys = Object.keys(this.selectedNodesById);
    for (var i = 0; i < selectedNodeKeys.length; i++) {
        // skip the 'just selected' row
        var key = selectedNodeKeys[i];
        var nodeToDeselect = this.selectedNodesById[key];
        if (nodeToDeselect === nodeToKeepSelected) {
            continue;
        } else {
            this.deselectRealNode(nodeToDeselect);
            atLeastOneSelectionChange = true;
        }
    }
    return atLeastOneSelectionChange;
};

// private
SelectionController.prototype.deselectRealNode = function(node) {
    // deselect the css
    this.removeCssClassForNode(node);

    // if node is a header, and if it has a sibling footer, deselect the footer also
    if (node.group && node.expanded && node.sibling) { // also check that it's expanded, as sibling could be a ghost
        this.removeCssClassForNode(node.sibling);
    }

    // remove the row
    delete this.selectedNodesById[node.id];
};

// private
SelectionController.prototype.removeCssClassForNode = function(node) {
    var virtualRenderedRowIndex = this.rowRenderer.getIndexOfRenderedNode(node);
    if (virtualRenderedRowIndex >= 0) {
        utils.querySelectorAll_removeCssClass(this.eRowsParent, '[row="' + virtualRenderedRowIndex + '"]', 'ag-row-selected');
        // inform virtual row listener
        this.angularGrid.onVirtualRowSelected(virtualRenderedRowIndex, false);
    }
};

// public (selectionRendererFactory)
SelectionController.prototype.deselectIndex = function(rowIndex) {
    var node = this.rowModel.getVirtualRow(rowIndex);
    this.deselectNode(node);
};

// public (api)
SelectionController.prototype.deselectNode = function(node) {
    if (node) {
        if (this.gridOptionsWrapper.isGroupSelectsChildren() && node.group) {
            // want to deselect children, not this node, so recursively deselect
            this.recursivelyDeselectAllChildren(node);
        } else {
            this.deselectRealNode(node);
        }
    }
    this.syncSelectedRowsAndCallListener();
    this.updateGroupParentsIfNeeded();
};

// public (selectionRendererFactory & api)
SelectionController.prototype.selectIndex = function(index, tryMulti, suppressEvents) {
    var node = this.rowModel.getVirtualRow(index);
    this.selectNode(node, tryMulti, suppressEvents);
};

// private
// updates the selectedRows with the selectedNodes and calls selectionChanged listener
SelectionController.prototype.syncSelectedRowsAndCallListener = function(suppressEvents) {
    // update selected rows
    var selectedRows = this.selectedRows;
    var oldCount = selectedRows.length;
    // clear selected rows
    selectedRows.length = 0;
    var keys = Object.keys(this.selectedNodesById);
    for (var i = 0; i < keys.length; i++) {
        if (this.selectedNodesById[keys[i]] !== undefined) {
            var selectedNode = this.selectedNodesById[keys[i]];
            selectedRows.push(selectedNode.data);
        }
    }

    // this stope the event firing the very first the time grid is initialised. without this, the documentation
    // page had a popup in the 'selection' page as soon as the page was loaded!!
    var nothingChangedMustBeInitialising = oldCount === 0 && selectedRows.length === 0;

    if (!nothingChangedMustBeInitialising && !suppressEvents && typeof this.gridOptionsWrapper.getSelectionChanged() === "function") {
        this.gridOptionsWrapper.getSelectionChanged()();
    }

    var that = this;
    setTimeout(function() {
        that.$scope.$apply();
    }, 0);
};

// private
SelectionController.prototype.recursivelyCheckIfSelected = function(node) {
    var foundSelected = false;
    var foundUnselected = false;

    if (node.children) {
        for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var result;
            if (child.group) {
                result = this.recursivelyCheckIfSelected(child);
                switch (result) {
                    case SELECTED:
                        foundSelected = true;
                        break;
                    case UNSELECTED:
                        foundUnselected = true;
                        break;
                    case MIXED:
                        foundSelected = true;
                        foundUnselected = true;
                        break;
                        // we can ignore the DO_NOT_CARE, as it doesn't impact, means the child
                        // has no children and shouldn't be considered when deciding
                }
            } else {
                if (this.isNodeSelected(child)) {
                    foundSelected = true;
                } else {
                    foundUnselected = true;
                }
            }

            if (foundSelected && foundUnselected) {
                // if mixed, then no need to go further, just return up the chain
                return MIXED;
            }
        }
    }

    // got this far, so no conflicts, either all children selected, unselected, or neither
    if (foundSelected) {
        return SELECTED;
    } else if (foundUnselected) {
        return UNSELECTED;
    } else {
        return DO_NOT_CARE;
    }
};

// public (selectionRendererFactory)
// returns:
// true: if selected
// false: if unselected
// undefined: if it's a group and 'children selection' is used and 'children' are a mix of selected and unselected
SelectionController.prototype.isNodeSelected = function(node) {
    if (this.gridOptionsWrapper.isGroupSelectsChildren() && node.group) {
        // doing child selection, we need to traverse the children
        var resultOfChildren = this.recursivelyCheckIfSelected(node);
        switch (resultOfChildren) {
            case SELECTED:
                return true;
            case UNSELECTED:
                return false;
            default:
                return undefined;
        }
    } else {
        return this.selectedNodesById[node.id] !== undefined;
    }
};

SelectionController.prototype.updateGroupParentsIfNeeded = function() {
    // we only do this if parent nodes are responsible
    // for selecting their children.
    if (!this.gridOptionsWrapper.isGroupSelectsChildren()) {
        return;
    }

    var firstRow = this.rowRenderer.getFirstVirtualRenderedRow();
    var lastRow = this.rowRenderer.getLastVirtualRenderedRow();
    for (var rowIndex = firstRow; rowIndex <= lastRow; rowIndex++) {
        // see if node is a group
        var node = this.rowModel.getVirtualRow(rowIndex);
        if (node.group) {
            var selected = this.isNodeSelected(node);
            this.angularGrid.onVirtualRowSelected(rowIndex, selected);

            if (selected) {
                utils.querySelectorAll_addCssClass(this.eRowsParent, '[row="' + rowIndex + '"]', 'ag-row-selected');
            } else {
                utils.querySelectorAll_removeCssClass(this.eRowsParent, '[row="' + rowIndex + '"]', 'ag-row-selected');
            }
        }
    }
};

module.exports = SelectionController;

},{"./utils":27}],22:[function(require,module,exports){
function SelectionRendererFactory() {}

SelectionRendererFactory.prototype.init = function(angularGrid, selectionController) {
    this.angularGrid = angularGrid;
    this.selectionController = selectionController;
};

SelectionRendererFactory.prototype.createCheckboxColDef = function() {
    return {
        width: 30,
        suppressMenu: true,
        suppressSorting: true,
        headerCellRenderer: function() {
            var eCheckbox = document.createElement('input');
            eCheckbox.type = 'checkbox';
            eCheckbox.name = 'name';
            return eCheckbox;
        },
        cellRenderer: this.createCheckboxRenderer()
    };
};

SelectionRendererFactory.prototype.createCheckboxRenderer = function() {
    var that = this;
    return function(params) {
        return that.createSelectionCheckbox(params.node, params.rowIndex);
    };
};

SelectionRendererFactory.prototype.createSelectionCheckbox = function(node, rowIndex) {

    var eCheckbox = document.createElement('input');
    eCheckbox.type = "checkbox";
    eCheckbox.name = "name";
    eCheckbox.className = 'ag-selection-checkbox';
    setCheckboxState(eCheckbox, this.selectionController.isNodeSelected(node));

    var that = this;
    eCheckbox.onclick = function(event) {
        event.stopPropagation();
    };

    eCheckbox.onchange = function() {
        var newValue = eCheckbox.checked;
        if (newValue) {
            that.selectionController.selectIndex(rowIndex, true);
        } else {
            that.selectionController.deselectIndex(rowIndex);
        }
    };

    this.angularGrid.addVirtualRowListener(rowIndex, {
        rowSelected: function(selected) {
            setCheckboxState(eCheckbox, selected);
        },
        rowRemoved: function() {}
    });

    return eCheckbox;
};

function setCheckboxState(eCheckbox, state) {
    if (typeof state === 'boolean') {
        eCheckbox.checked = state;
        eCheckbox.indeterminate = false;
    } else {
        // isNodeSelected returns back undefined if it's a group and the children
        // are a mix of selected and unselected
        eCheckbox.indeterminate = true;
    }
}

module.exports = SelectionRendererFactory;

},{}],23:[function(require,module,exports){
var SVG_NS = "http://www.w3.org/2000/svg";

function SvgFactory() {}

SvgFactory.prototype.createFilterSvg = function() {
    var eSvg = createIconSvg();

    var eFunnel = document.createElementNS(SVG_NS, "polygon");
    eFunnel.setAttribute("points", "0,0 4,4 4,10 6,10 6,4 10,0");
    eFunnel.setAttribute("class", "ag-header-icon");
    eSvg.appendChild(eFunnel);

    return eSvg;
};

SvgFactory.prototype.createMenuSvg = function() {
    var eSvg = document.createElementNS(SVG_NS, "svg");
    var size = "12";
    eSvg.setAttribute("width", size);
    eSvg.setAttribute("height", size);

    ["0", "5", "10"].forEach(function(y) {
        var eLine = document.createElementNS(SVG_NS, "rect");
        eLine.setAttribute("y", y);
        eLine.setAttribute("width", size);
        eLine.setAttribute("height", "2");
        eLine.setAttribute("class", "ag-header-icon");
        eSvg.appendChild(eLine);
    });

    return eSvg;
};

SvgFactory.prototype.createArrowUpSvg = function() {
    return createPolygonSvg("0,10 5,0 10,10");
};

SvgFactory.prototype.createArrowLeftSvg = function() {
    return createPolygonSvg("10,0 0,5 10,10");
};

SvgFactory.prototype.createArrowDownSvg = function() {
    return createPolygonSvg("0,0 5,10 10,0");
};

SvgFactory.prototype.createArrowRightSvg = function() {
    return createPolygonSvg("0,0 10,5 0,10");
};

function createPolygonSvg(points) {
    var eSvg = createIconSvg();

    var eDescIcon = document.createElementNS(SVG_NS, "polygon");
    eDescIcon.setAttribute("points", points);
    eSvg.appendChild(eDescIcon);

    return eSvg;
}

// util function for the above
function createIconSvg() {
    var eSvg = document.createElementNS(SVG_NS, "svg");
    eSvg.setAttribute("width", "10");
    eSvg.setAttribute("height", "10");
    return eSvg;
}

module.exports = SvgFactory;

},{}],24:[function(require,module,exports){
var template = [
    '<div class="ag-root ag-scrolls">',
    '    <!-- The loading panel -->',
    '    <!-- wrapping in outer div, and wrapper, is needed to center the loading icon -->',
    '    <!-- The idea for centering came from here: http://www.vanseodesign.com/css/vertical-centering/ -->',
    '    <div class="ag-loading-panel">',
    '        <div class="ag-loading-wrapper">',
    '            <span class="ag-loading-center">Loading...</span>',
    '        </div>',
    '    </div>',
    '    <!-- header -->',
    '    <div class="ag-header">',
    '        <div class="ag-pinned-header"></div><div class="ag-header-viewport"><div class="ag-header-container"></div></div>',
    '    </div>',
    '    <!-- body -->',
    '    <div class="ag-body">',
    '        <div class="ag-pinned-cols-viewport">',
    '            <div class="ag-pinned-cols-container"></div>',
    '        </div>',
    '        <div class="ag-body-viewport-wrapper">',
    '            <div class="ag-body-viewport">',
    '                <div class="ag-body-container"></div>',
    '            </div>',
    '        </div>',
    '    </div>',
    '    <!-- Paging -->',
    '    <div class="ag-paging-panel">',
    '    </div>',
    '    </div>'
].join('');

module.exports = template;

},{}],25:[function(require,module,exports){
var template = [
    '<div class="ag-root ag-no-scrolls">',
    '    <!-- See comment in template.html for why loading is laid out like so -->',
    '    <div class="ag-loading-panel">',
    '        <div class="ag-loading-wrapper">',
    '            <span class="ag-loading-center">Loading...</span>',
    '        </div>',
    '    </div>',
    '    <!-- header -->',
    '    <div class="ag-header-container"></div>',
    '    <!-- body -->',
    '    <div class="ag-body-container"></div>',
    '</div>'
].join('');


module.exports = template;

},{}],26:[function(require,module,exports){

function TemplateService() {
    this.templateCache = {};
    this.waitingCallbacks = {};
}

TemplateService.prototype.init = function ($scope) {
    this.$scope = $scope;
};

// returns the template if it is loaded, or null if it is not loaded
// but will call the callback when it is loaded
TemplateService.prototype.getTemplate = function (url, callback) {

    var templateFromCache = this.templateCache[url];
    if (templateFromCache) {
        return templateFromCache;
    }

    var callbackList = this.waitingCallbacks[url];
    var that = this;
    if (!callbackList) {
        // first time this was called, so need a new list for callbacks
        callbackList = [];
        this.waitingCallbacks[url] = callbackList;
        // and also need to do the http request
        var client = new XMLHttpRequest();
        client.onload = function () { that.handleHttpResult(this, url); };
        client.open("GET", url);
        client.send();
    }

    // add this callback
    if (callback) {
        callbackList.push(callback);
    }

    // caller needs to wait for template to load, so return null
    return null;
};

TemplateService.prototype.handleHttpResult = function (httpResult, url) {

    if (httpResult.status !== 200 || httpResult.response === null) {
        console.log('Unable to get template error ' + httpResult.status + ' - ' + url);
        return;
    }

    // response success, so process it
    this.templateCache[url] = httpResult.response;

    // inform all listeners that this is now in the cache
    var callbacks = this.waitingCallbacks[url];
    for (var i = 0; i < callbacks.length; i++) {
        var callback = callbacks[i];
        // we could pass the callback the response, however we know the client of this code
        // is the cell renderer, and it passes the 'cellRefresh' method in as the callback
        // which doesn't take any parameters.
        callback();
    }

    if (this.$scope) {
        var that = this;
        setTimeout(function() {
            that.$scope.$apply();
        }, 0);
    }
};

module.exports = TemplateService;

},{}],27:[function(require,module,exports){
function Utils() {}


Utils.prototype.getValue = function(expressionService, data, colDef, node, api, context) {

    var valueGetter = colDef.valueGetter;
    var field = colDef.field;

    // if there is a value getter, this gets precedence over a field
    if (valueGetter) {

        var params = {
            data: data,
            node: node,
            colDef: colDef,
            api: api,
            context: context
        };

        if (typeof valueGetter === 'function') {
            // valueGetter is a function, so just call it
            return valueGetter(params);
        } else if (typeof valueGetter === 'string') {
            // valueGetter is an expression, so execute the expression
            return expressionService.evaluate(valueGetter, params);
        }

    } else if (field && data) {
        return data[field];
    } else {
        return undefined;
    }
};

//Returns true if it is a DOM node
//taken from: http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
Utils.prototype.isNode = function(o) {
    return (
        typeof Node === "object" ? o instanceof Node :
        o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName === "string"
    );
};

//Returns true if it is a DOM element
//taken from: http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
Utils.prototype.isElement = function(o) {
    return (
        typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
        o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName === "string"
    );
};

Utils.prototype.isNodeOrElement = function(o) {
    return this.isNode(o) || this.isElement(o);
};

//adds all type of change listeners to an element, intended to be a text field
Utils.prototype.addChangeListener = function(element, listener) {
    element.addEventListener("changed", listener);
    element.addEventListener("paste", listener);
    element.addEventListener("input", listener);
};

//if value is undefined, null or blank, returns null, otherwise returns the value
Utils.prototype.makeNull = function(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    } else {
        return value;
    }
};

Utils.prototype.removeAllChildren = function(node) {
    if (node) {
        while (node.hasChildNodes()) {
            node.removeChild(node.lastChild);
        }
    }
};

//adds an element to a div, but also adds a background checking for clicks,
//so that when the background is clicked, the child is removed again, giving
//a model look to popups.
Utils.prototype.addAsModalPopup = function(eParent, eChild) {
    var parent = angular.element(eChild);

    function doRemove(){
        parent.remove();
        document.documentElement.removeEventListener('mouseup', removePopups);
        document.documentElement.removeEventListener('keyup', onkeyup);
    }

    var removePopups = function(evt) {
        var targetParent = angular.element(evt.target).parents('.ag-filter');
        if(targetParent[0] !== parent[0]){
            doRemove();
        }
    };

    var onkeyup = function(evt) {
        if(evt.keyCode === 27){
            doRemove();
        }
    };

    eParent.appendChild(eChild);

    setTimeout(function(){
        document.documentElement.addEventListener('mouseup', removePopups);
        document.documentElement.addEventListener('keyup', onkeyup, true);
    }, 0);
};

//loads the template and returns it as an element. makes up for no simple way in
//the dom api to load html directly, eg we cannot do this: document.createElement(template)
Utils.prototype.loadTemplate = function(template) {
    var tempDiv = document.createElement("div");
    tempDiv.innerHTML = template;
    return tempDiv.firstChild;
};

//if passed '42px' then returns the number 42
Utils.prototype.pixelStringToNumber = function(val) {
    if (typeof val === "string") {
        if (val.indexOf("px") >= 0) {
            val.replace("px", "");
        }
        return parseInt(val);
    } else {
        return val;
    }
};

Utils.prototype.querySelectorAll_addCssClass = function(eParent, selector, cssClass) {
    var eRows = eParent.querySelectorAll(selector);
    for (var k = 0; k < eRows.length; k++) {
        this.addCssClass(eRows[k], cssClass);
    }
};

Utils.prototype.querySelectorAll_removeCssClass = function(eParent, selector, cssClass) {
    var eRows = eParent.querySelectorAll(selector);
    for (var k = 0; k < eRows.length; k++) {
        this.removeCssClass(eRows[k], cssClass);
    }
};

Utils.prototype.querySelectorAll_replaceCssClass = function(eParent, selector, cssClassToRemove, cssClassToAdd) {
    var eRows = eParent.querySelectorAll(selector);
    for (var k = 0; k < eRows.length; k++) {
        this.removeCssClass(eRows[k], cssClassToRemove);
        this.addCssClass(eRows[k], cssClassToAdd);
    }
};

Utils.prototype.addCssClass = function(element, className) {
    var oldClasses = element.className;
    if (oldClasses) {
        if (oldClasses.indexOf(className) >= 0) {
            return;
        }
        element.className = oldClasses + " " + className;
    } else {
        element.className = className;
    }
};

Utils.prototype.removeCssClass = function(element, className) {
    var oldClasses = element.className;
    if (oldClasses.indexOf(className) < 0) {
        return;
    }
    var newClasses = oldClasses.replace(" " + className, "");
    newClasses = newClasses.replace(className + " ", "");
    if (newClasses == className) {
        newClasses = "";
    }
    element.className = newClasses;
};

Utils.prototype.removeFromArray = function(array, object) {
    array.splice(array.indexOf(object), 1);
};

Utils.prototype.defaultComparator = function(valueA, valueB) {
    var valueAMissing = valueA === null || valueA === undefined;
    var valueBMissing = valueB === null || valueB === undefined;
    if (valueAMissing && valueBMissing) {
        return 0;
    }
    if (valueAMissing) {
        return -1;
    }
    if (valueBMissing) {
        return 1;
    }

    if (valueA < valueB) {
        return -1;
    } else if (valueA > valueB) {
        return 1;
    } else {
        return 0;
    }
};

Utils.prototype.formatWidth = function(width) {
    if (typeof width === "number") {
        return width + "px";
    } else {
        return width;
    }
};

// tries to use the provided renderer. if a renderer found, returns true.
// if no renderer, returns false.
Utils.prototype.useRenderer = function(eParent, eRenderer, params) {
    var resultFromRenderer = eRenderer(params);
    if (this.isNode(resultFromRenderer) || this.isElement(resultFromRenderer)) {
        //a dom node or element was returned, so add child
        eParent.appendChild(resultFromRenderer);
    } else {
        //otherwise assume it was html, so just insert
        var eTextSpan = document.createElement('span');
        eTextSpan.innerHTML = resultFromRenderer;
        eParent.appendChild(eTextSpan);
    }
};

// if icon provided, use this (either a string, or a function callback).
// if not, then use the second parameter, which is the svgFactory function
Utils.prototype.createIcon = function(iconName, gridOptionsWrapper, colDefWrapper, svgFactoryFunc) {
    var eResult = document.createElement('span');
    var userProvidedIcon;
    // check col for icon first
    if (colDefWrapper && colDefWrapper.colDef.icons) {
        userProvidedIcon = colDefWrapper.colDef.icons[iconName];
    }
    // it not in col, try grid options
    if (!userProvidedIcon && gridOptionsWrapper.getIcons()) {
        userProvidedIcon = gridOptionsWrapper.getIcons()[iconName];
    }
    // now if user provided, use it
    if (userProvidedIcon) {
        var rendererResult;
        if (typeof userProvidedIcon === 'function') {
            rendererResult = userProvidedIcon();
        } else if (typeof userProvidedIcon === 'string') {
            rendererResult = userProvidedIcon;
        } else {
            throw 'icon from grid options needs to be a string or a function';
        }
        if (typeof rendererResult === 'string') {
            eResult.innerHTML = rendererResult;
        } else if (this.isNodeOrElement(rendererResult)) {
            eResult.appendChild(rendererResult);
        } else {
            throw 'iconRenderer should return back a string or a dom object';
        }
    } else {
        // otherwise we use the built in icon
        eResult.appendChild(svgFactoryFunc());
    }
    return eResult;
};


Utils.prototype.getScrollbarWidth = function () {
    var outer = document.createElement("div");
    outer.style.visibility = "hidden";
    outer.style.width = "100px";
    outer.style.msOverflowStyle = "scrollbar"; // needed for WinJS apps

    document.body.appendChild(outer);

    var widthNoScroll = outer.offsetWidth;
    // force scrollbars
    outer.style.overflow = "scroll";

    // add innerdiv
    var inner = document.createElement("div");
    inner.style.width = "100%";
    outer.appendChild(inner);

    var widthWithScroll = inner.offsetWidth;

    // remove divs
    outer.parentNode.removeChild(outer);

    return widthNoScroll - widthWithScroll;
};

module.exports = new Utils();

},{}],28:[function(require,module,exports){
/*
 * This row controller is used for infinite scrolling only. For normal 'in memory' table,
 * or standard pagination, the inMemoryRowController is used.
 */

var logging = true;

function VirtualPageRowController() {}

VirtualPageRowController.prototype.init = function(rowRenderer) {
    this.rowRenderer = rowRenderer;
    this.datasourceVersion = 0;
};

VirtualPageRowController.prototype.setDatasource = function(datasource) {
    this.datasource = datasource;

    if (!datasource) {
        // only continue if we have a valid datasource to working with
        return;
    }

    this.reset();
};

VirtualPageRowController.prototype.reset = function() {
    // see if datasource knows how many rows there are
    if (typeof this.datasource.rowCount === 'number' && this.datasource.rowCount >= 0) {
        this.virtualRowCount = this.datasource.rowCount;
        this.foundMaxRow = true;
    } else {
        this.virtualRowCount = 0;
        this.foundMaxRow = false;
    }

    // in case any daemon requests coming from datasource, we know it ignore them
    this.datasourceVersion++;

    // map of page numbers to rows in that page
    this.pageCache = {};
    this.pageCacheSize = 0;

    // if a number is in this array, it means we are pending a load from it
    this.pageLoadsInProgress = [];
    this.pageLoadsQueued = [];
    this.pageAccessTimes = {}; // keeps a record of when each page was last viewed, used for LRU cache
    this.accessTime = 0; // rather than using the clock, we use this counter

    // the number of concurrent loads we are allowed to the server
    if (typeof this.datasource.maxConcurrentRequests === 'number' && this.datasource.maxConcurrentRequests > 0) {
        this.maxConcurrentDatasourceRequests = this.datasource.maxConcurrentRequests;
    } else {
        this.maxConcurrentDatasourceRequests = 2;
    }

    // the number of pages to keep in browser cache
    if (typeof this.datasource.maxPagesInCache === 'number' && this.datasource.maxPagesInCache > 0) {
        this.maxPagesInCache = this.datasource.maxPagesInCache;
    } else {
        // null is default, means don't  have any max size on the cache
        this.maxPagesInCache = null;
    }

    this.pageSize = this.datasource.pageSize; // take a copy of page size, we don't want it changing
    this.overflowSize = this.datasource.overflowSize; // take a copy of page size, we don't want it changing

    this.doLoadOrQueue(0);
};

VirtualPageRowController.prototype.createNodesFromRows = function(pageNumber, rows) {
    var nodes = [];
    if (rows) {
        for (var i = 0, j = rows.length; i < j; i++) {
            var virtualRowIndex = (pageNumber * this.pageSize) + i;
            nodes.push({
                data: rows[i],
                id: virtualRowIndex
            });
        }
    }
    return nodes;
};

VirtualPageRowController.prototype.removeFromLoading = function(pageNumber) {
    var index = this.pageLoadsInProgress.indexOf(pageNumber);
    this.pageLoadsInProgress.splice(index, 1);
};

VirtualPageRowController.prototype.pageLoadFailed = function(pageNumber) {
    this.removeFromLoading(pageNumber);
    this.checkQueueForNextLoad();
};

VirtualPageRowController.prototype.pageLoaded = function(pageNumber, rows, lastRow) {
    this.putPageIntoCacheAndPurge(pageNumber, rows);
    this.checkMaxRowAndInformRowRenderer(pageNumber, lastRow);
    this.removeFromLoading(pageNumber);
    this.checkQueueForNextLoad();
};

VirtualPageRowController.prototype.putPageIntoCacheAndPurge = function(pageNumber, rows) {
    this.pageCache[pageNumber] = this.createNodesFromRows(pageNumber, rows);
    this.pageCacheSize++;
    if (logging) {
        console.log('adding page ' + pageNumber);
    }

    var needToPurge = this.maxPagesInCache && this.maxPagesInCache < this.pageCacheSize;
    if (needToPurge) {
        // find the LRU page
        var youngestPageIndex = this.findLeastRecentlyAccessedPage(Object.keys(this.pageCache));

        if (logging) {
            console.log('purging page ' + youngestPageIndex + ' from cache ' + Object.keys(this.pageCache));
        }
        delete this.pageCache[youngestPageIndex];
        this.pageCacheSize--;
    }

};

VirtualPageRowController.prototype.checkMaxRowAndInformRowRenderer = function(pageNumber, lastRow) {
    if (!this.foundMaxRow) {
        // if we know the last row, use if
        if (typeof lastRow === 'number' && lastRow >= 0) {
            this.virtualRowCount = lastRow;
            this.foundMaxRow = true;
        } else {
            // otherwise, see if we need to add some virtual rows
            var thisPagePlusBuffer = ((pageNumber + 1) * this.pageSize) + this.overflowSize;
            if (this.virtualRowCount < thisPagePlusBuffer) {
                this.virtualRowCount = thisPagePlusBuffer;
            }
        }
        // if rowCount changes, refreshView, otherwise just refreshAllVirtualRows
        this.rowRenderer.refreshView();
    } else {
        this.rowRenderer.refreshAllVirtualRows();
    }
};

VirtualPageRowController.prototype.isPageAlreadyLoading = function(pageNumber) {
    var result = this.pageLoadsInProgress.indexOf(pageNumber) >= 0 || this.pageLoadsQueued.indexOf(pageNumber) >= 0;
    return result;
};

VirtualPageRowController.prototype.doLoadOrQueue = function(pageNumber) {
    // if we already tried to load this page, then ignore the request,
    // otherwise server would be hit 50 times just to display one page, the
    // first row to find the page missing is enough.
    if (this.isPageAlreadyLoading(pageNumber)) {
        return;
    }

    // try the page load - if not already doing a load, then we can go ahead
    if (this.pageLoadsInProgress.length < this.maxConcurrentDatasourceRequests) {
        // go ahead, load the page
        this.loadPage(pageNumber);
    } else {
        // otherwise, queue the request
        this.addToQueueAndPurgeQueue(pageNumber);
    }
};

VirtualPageRowController.prototype.addToQueueAndPurgeQueue = function(pageNumber) {
    if (logging) {
        console.log('queueing ' + pageNumber + ' - ' + this.pageLoadsQueued);
    }
    this.pageLoadsQueued.push(pageNumber);

    // see if there are more pages queued that are actually in our cache, if so there is
    // no point in loading them all as some will be purged as soon as loaded
    var needToPurge = this.maxPagesInCache && this.maxPagesInCache < this.pageLoadsQueued.length;
    if (needToPurge) {
        // find the LRU page
        var youngestPageIndex = this.findLeastRecentlyAccessedPage(this.pageLoadsQueued);

        if (logging) {
            console.log('de-queueing ' + pageNumber + ' - ' + this.pageLoadsQueued);
        }

        var indexToRemove = this.pageLoadsQueued.indexOf(youngestPageIndex);
        this.pageLoadsQueued.splice(indexToRemove, 1);
    }
};

VirtualPageRowController.prototype.findLeastRecentlyAccessedPage = function(pageIndexes) {
    var youngestPageIndex = -1;
    var youngestPageAccessTime = Number.MAX_VALUE;
    var that = this;

    pageIndexes.forEach(function(pageIndex) {
        var accessTimeThisPage = that.pageAccessTimes[pageIndex];
        if (accessTimeThisPage < youngestPageAccessTime) {
            youngestPageAccessTime = accessTimeThisPage;
            youngestPageIndex = pageIndex;
        }
    });

    return youngestPageIndex;
};

VirtualPageRowController.prototype.checkQueueForNextLoad = function() {
    if (this.pageLoadsQueued.length > 0) {
        // take from the front of the queue
        var pageToLoad = this.pageLoadsQueued[0];
        this.pageLoadsQueued.splice(0, 1);

        if (logging) {
            console.log('dequeueing ' + pageToLoad + ' - ' + this.pageLoadsQueued);
        }

        this.loadPage(pageToLoad);
    }
};

VirtualPageRowController.prototype.loadPage = function(pageNumber) {

    this.pageLoadsInProgress.push(pageNumber);

    var startRow = pageNumber * this.pageSize;
    var endRow = (pageNumber + 1) * this.pageSize;

    var that = this;
    var datasourceVersionCopy = this.datasourceVersion;

    this.datasource.getRows(startRow, endRow,
        function success(rows, lastRow) {
            if (that.requestIsDaemon(datasourceVersionCopy)) {
                return;
            }
            that.pageLoaded(pageNumber, rows, lastRow);
        },
        function fail() {
            if (that.requestIsDaemon(datasourceVersionCopy)) {
                return;
            }
            that.pageLoadFailed(pageNumber);
        }
    );
};

// check that the datasource has not changed since the lats time we did a request
VirtualPageRowController.prototype.requestIsDaemon = function(datasourceVersionCopy) {
    return this.datasourceVersion !== datasourceVersionCopy;
};

VirtualPageRowController.prototype.getVirtualRow = function(rowIndex) {
    if (rowIndex > this.virtualRowCount) {
        return null;
    }

    var pageNumber = Math.floor(rowIndex / this.pageSize);
    var page = this.pageCache[pageNumber];

    // for LRU cache, track when this page was last hit
    this.pageAccessTimes[pageNumber] = this.accessTime++;

    if (!page) {
        this.doLoadOrQueue(pageNumber);
        // return back an empty row, so table can at least render empty cells
        return {
            data: {},
            id: rowIndex
        };
    } else {
        var indexInThisPage = rowIndex % this.pageSize;
        return page[indexInThisPage];
    }
};

VirtualPageRowController.prototype.getModel = function() {
    var that = this;
    return {
        getVirtualRow: function(index) {
            return that.getVirtualRow(index);
        },
        getVirtualRowCount: function() {
            return that.virtualRowCount;
        }
    };
};

module.exports = VirtualPageRowController;

},{}]},{},[18])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvanMvY2VsbFJlbmRlcmVycy9ncm91cENlbGxSZW5kZXJlckZhY3RvcnkuanMiLCJzcmMvanMvY29sdW1uQ29udHJvbGxlci5qcyIsInNyYy9qcy9jb25zdGFudHMuanMiLCJzcmMvanMvZXhwcmVzc2lvblNlcnZpY2UuanMiLCJzcmMvanMvZmlsdGVyL2ZpbHRlck1hbmFnZXIuanMiLCJzcmMvanMvZmlsdGVyL251bWJlckZpbHRlci5qcyIsInNyYy9qcy9maWx0ZXIvbnVtYmVyRmlsdGVyVGVtcGxhdGUuanMiLCJzcmMvanMvZmlsdGVyL3NldEZpbHRlci5qcyIsInNyYy9qcy9maWx0ZXIvc2V0RmlsdGVyTW9kZWwuanMiLCJzcmMvanMvZmlsdGVyL3NldEZpbHRlclRlbXBsYXRlLmpzIiwic3JjL2pzL2ZpbHRlci90ZXh0RmlsdGVyLmpzIiwic3JjL2pzL2ZpbHRlci90ZXh0RmlsdGVyVGVtcGxhdGUuanMiLCJzcmMvanMvZ3JpZC5qcyIsInNyYy9qcy9ncmlkT3B0aW9uc1dyYXBwZXIuanMiLCJzcmMvanMvZ3JvdXBDcmVhdG9yLmpzIiwic3JjL2pzL2hlYWRlclJlbmRlcmVyLmpzIiwic3JjL2pzL2luTWVtb3J5Um93Q29udHJvbGxlci5qcyIsInNyYy9qcy9tYWluLmpzIiwic3JjL2pzL3BhZ2luYXRpb25Db250cm9sbGVyLmpzIiwic3JjL2pzL3Jvd1JlbmRlcmVyLmpzIiwic3JjL2pzL3NlbGVjdGlvbkNvbnRyb2xsZXIuanMiLCJzcmMvanMvc2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5LmpzIiwic3JjL2pzL3N2Z0ZhY3RvcnkuanMiLCJzcmMvanMvdGVtcGxhdGUuanMiLCJzcmMvanMvdGVtcGxhdGVOb1Njcm9sbHMuanMiLCJzcmMvanMvdGVtcGxhdGVTZXJ2aWNlLmpzIiwic3JjL2pzL3V0aWxzLmpzIiwic3JjL2pzL3ZpcnR1YWxQYWdlUm93Q29udHJvbGxlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9QQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6ekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3ZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVrQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgU3ZnRmFjdG9yeSA9IHJlcXVpcmUoJy4uL3N2Z0ZhY3RvcnknKTtcclxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcclxudmFyIHN2Z0ZhY3RvcnkgPSBuZXcgU3ZnRmFjdG9yeSgpO1xyXG5cclxuZnVuY3Rpb24gZ3JvdXBDZWxsUmVuZGVyZXJGYWN0b3J5KGdyaWRPcHRpb25zV3JhcHBlciwgc2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5KSB7XHJcblxyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGdyb3VwQ2VsbFJlbmRlcmVyKHBhcmFtcykge1xyXG5cclxuICAgICAgICB2YXIgZUdyb3VwQ2VsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgICAgICB2YXIgbm9kZSA9IHBhcmFtcy5ub2RlO1xyXG5cclxuICAgICAgICB2YXIgZXhwYW5kSWNvbk5lZWRlZCA9IG5vZGUuZ3JvdXAgJiYgIW5vZGUuZm9vdGVyO1xyXG4gICAgICAgIGlmIChleHBhbmRJY29uTmVlZGVkKSB7XHJcbiAgICAgICAgICAgIHZhciBlRXhwYW5kSWNvbiA9IGNyZWF0ZUdyb3VwRXhwYW5kSWNvbihub2RlLmV4cGFuZGVkKTtcclxuICAgICAgICAgICAgZUdyb3VwQ2VsbC5hcHBlbmRDaGlsZChlRXhwYW5kSWNvbik7XHJcbiAgICAgICAgICAgIGVFeHBhbmRJY29uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICBleHBhbmRHcm91cChub2RlLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBjaGVja2JveE5lZWRlZCA9IHBhcmFtcy5jb2xEZWYgJiYgcGFyYW1zLmNvbERlZi5jZWxsUmVuZGVyZXIgJiYgcGFyYW1zLmNvbERlZi5jZWxsUmVuZGVyZXIuY2hlY2tib3ggJiYgIW5vZGUuZm9vdGVyO1xyXG4gICAgICAgIGlmIChjaGVja2JveE5lZWRlZCkge1xyXG4gICAgICAgICAgICB2YXIgZUNoZWNrYm94ID0gc2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5LmNyZWF0ZVNlbGVjdGlvbkNoZWNrYm94KG5vZGUsIHBhcmFtcy5yb3dJbmRleCk7XHJcbiAgICAgICAgICAgIGVHcm91cENlbGwuYXBwZW5kQ2hpbGQoZUNoZWNrYm94KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChwYXJhbXMuY29sRGVmICYmIHBhcmFtcy5jb2xEZWYuY2VsbFJlbmRlcmVyICYmIHBhcmFtcy5jb2xEZWYuY2VsbFJlbmRlcmVyLmlubmVyUmVuZGVyZXIpIHtcclxuICAgICAgICAgICAgY3JlYXRlRnJvbUlubmVyUmVuZGVyZXIoZUdyb3VwQ2VsbCwgcGFyYW1zLCBwYXJhbXMuY29sRGVmLmNlbGxSZW5kZXJlci5pbm5lclJlbmRlcmVyKTtcclxuICAgICAgICB9IGVsc2UgaWYgKG5vZGUuZm9vdGVyKSB7XHJcbiAgICAgICAgICAgIGNyZWF0ZUZvb3RlckNlbGwoZUdyb3VwQ2VsbCwgbm9kZSk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChub2RlLmdyb3VwKSB7XHJcbiAgICAgICAgICAgIGNyZWF0ZUdyb3VwQ2VsbChlR3JvdXBDZWxsLCBub2RlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjcmVhdGVMZWFmQ2VsbChlR3JvdXBDZWxsLCBwYXJhbXMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gb25seSBkbyB0aGlzIGlmIGFuIGluZGVudCAtIGFzIHRoaXMgb3ZlcndyaXRlcyB0aGUgcGFkZGluZyB0aGF0XHJcbiAgICAgICAgLy8gdGhlIHRoZW1lIHNldCwgd2hpY2ggd2lsbCBtYWtlIHRoaW5ncyBsb29rICdub3QgYWxpZ25lZCcgZm9yIHRoZVxyXG4gICAgICAgIC8vIGZpcnN0IGdyb3VwIGxldmVsLlxyXG4gICAgICAgIGlmIChub2RlLmZvb3RlciB8fCBub2RlLmxldmVsID4gMCkge1xyXG4gICAgICAgICAgICB2YXIgcGFkZGluZ1B4ID0gbm9kZS5sZXZlbCAqIDEwO1xyXG4gICAgICAgICAgICBpZiAobm9kZS5mb290ZXIpIHtcclxuICAgICAgICAgICAgICAgIHBhZGRpbmdQeCArPSAxMDtcclxuICAgICAgICAgICAgfSBlbHNlIGlmICghbm9kZS5ncm91cCkge1xyXG4gICAgICAgICAgICAgICAgcGFkZGluZ1B4ICs9IDU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZUdyb3VwQ2VsbC5zdHlsZS5wYWRkaW5nTGVmdCA9IHBhZGRpbmdQeCArIFwicHhcIjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChub2RlLmdyb3VwKSB7XHJcbiAgICAgICAgICAgIGVHcm91cENlbGwuYWRkRXZlbnRMaXN0ZW5lcihcImRibGNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGV4cGFuZEdyb3VwKG5vZGUsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGVHcm91cENlbGw7XHJcbiAgICB9O1xyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUZyb21Jbm5lclJlbmRlcmVyKGVHcm91cENlbGwsIHBhcmFtcywgcmVuZGVyZXIpIHtcclxuICAgICAgICB1dGlscy51c2VSZW5kZXJlcihlR3JvdXBDZWxsLCByZW5kZXJlciwgcGFyYW1zKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBleHBhbmRHcm91cChub2RlLCBwYXJhbXMpIHtcclxuICAgICAgICBub2RlLmV4cGFuZGVkID0gIW5vZGUuZXhwYW5kZWQ7XHJcbiAgICAgICAgcGFyYW1zLmFwaS5vbkdyb3VwRXhwYW5kZWRPckNvbGxhcHNlZCgpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUdyb3VwRXhwYW5kSWNvbihleHBhbmRlZCkge1xyXG4gICAgICAgIGlmIChleHBhbmRlZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdXRpbHMuY3JlYXRlSWNvbignZ3JvdXBFeHBhbmRlZCcsIGdyaWRPcHRpb25zV3JhcHBlciwgbnVsbCwgc3ZnRmFjdG9yeS5jcmVhdGVBcnJvd0Rvd25TdmcpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiB1dGlscy5jcmVhdGVJY29uKCdncm91cENvbnRyYWN0ZWQnLCBncmlkT3B0aW9uc1dyYXBwZXIsIG51bGwsIHN2Z0ZhY3RvcnkuY3JlYXRlQXJyb3dSaWdodFN2Zyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIGNyZWF0ZXMgY2VsbCB3aXRoICdUb3RhbCB7e2tleX19JyBmb3IgYSBncm91cFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlRm9vdGVyQ2VsbChlUGFyZW50LCBub2RlKSB7XHJcbiAgICAgICAgdmFyIHRleHRUb0Rpc3BsYXkgPSBcIlRvdGFsIFwiICsgbm9kZS5rZXk7XHJcbiAgICAgICAgdmFyIGVUZXh0ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dFRvRGlzcGxheSk7XHJcbiAgICAgICAgZVBhcmVudC5hcHBlbmRDaGlsZChlVGV4dCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gY3JlYXRlcyBjZWxsIHdpdGggJ3t7a2V5fX0gKHt7Y2hpbGRDb3VudH19KScgZm9yIGEgZ3JvdXBcclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUdyb3VwQ2VsbChlUGFyZW50LCBub2RlKSB7XHJcbiAgICAgICAgdmFyIHRleHRUb0Rpc3BsYXkgPSBcIiBcIiArIG5vZGUua2V5O1xyXG4gICAgICAgIC8vIG9ubHkgaW5jbHVkZSB0aGUgY2hpbGQgY291bnQgaWYgaXQncyBpbmNsdWRlZCwgZWcgaWYgdXNlciBkb2luZyBjdXN0b20gYWdncmVnYXRpb24sXHJcbiAgICAgICAgLy8gdGhlbiB0aGlzIGNvdWxkIGJlIGxlZnQgb3V0LCBvciBzZXQgdG8gLTEsIGllIG5vIGNoaWxkIGNvdW50XHJcbiAgICAgICAgaWYgKG5vZGUuYWxsQ2hpbGRyZW5Db3VudCA+PSAwKSB7XHJcbiAgICAgICAgICAgIHRleHRUb0Rpc3BsYXkgKz0gXCIgKFwiICsgbm9kZS5hbGxDaGlsZHJlbkNvdW50ICsgXCIpXCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBlVGV4dCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRleHRUb0Rpc3BsYXkpO1xyXG4gICAgICAgIGVQYXJlbnQuYXBwZW5kQ2hpbGQoZVRleHQpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICAvLyBjcmVhdGVzIGNlbGwgd2l0aCAne3trZXl9fSAoe3tjaGlsZENvdW50fX0pJyBmb3IgYSBncm91cFxyXG4gICAgZnVuY3Rpb24gY3JlYXRlTGVhZkNlbGwoZVBhcmVudCwgcGFyYW1zKSB7XHJcbiAgICAgICAgaWYgKHBhcmFtcy52YWx1ZSkge1xyXG4gICAgICAgICAgICB2YXIgZVRleHQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnICcgKyBwYXJhbXMudmFsdWUpO1xyXG4gICAgICAgICAgICBlUGFyZW50LmFwcGVuZENoaWxkKGVUZXh0KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZ3JvdXBDZWxsUmVuZGVyZXJGYWN0b3J5OyIsInZhciBjb25zdGFudHMgPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xyXG5cclxuZnVuY3Rpb24gQ29sdW1uQ29udHJvbGxlcigpIHtcclxuICAgIHRoaXMuY3JlYXRlTW9kZWwoKTtcclxufVxyXG5cclxuQ29sdW1uQ29udHJvbGxlci5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKGFuZ3VsYXJHcmlkLCBzZWxlY3Rpb25SZW5kZXJlckZhY3RvcnksIGdyaWRPcHRpb25zV3JhcHBlcikge1xyXG4gICAgdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIgPSBncmlkT3B0aW9uc1dyYXBwZXI7XHJcbiAgICB0aGlzLmFuZ3VsYXJHcmlkID0gYW5ndWxhckdyaWQ7XHJcbiAgICB0aGlzLnNlbGVjdGlvblJlbmRlcmVyRmFjdG9yeSA9IHNlbGVjdGlvblJlbmRlcmVyRmFjdG9yeTtcclxufTtcclxuXHJcbkNvbHVtbkNvbnRyb2xsZXIucHJvdG90eXBlLmNyZWF0ZU1vZGVsID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICB0aGlzLm1vZGVsID0ge1xyXG4gICAgICAgIC8vIHVzZWQgYnk6XHJcbiAgICAgICAgLy8gKyBpbk1lbW9yeVJvd0NvbnRyb2xsZXIgLT4gc29ydGluZywgYnVpbGRpbmcgcXVpY2sgZmlsdGVyIHRleHRcclxuICAgICAgICAvLyArIGhlYWRlclJlbmRlcmVyIC0+IHNvcnRpbmcgKGNsZWFyaW5nIGljb24pXHJcbiAgICAgICAgZ2V0QWxsQ29sdW1uczogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGF0LmNvbHVtbnM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvLyArIHJvd0NvbnRyb2xsZXIgLT4gd2hpbGUgaW5zZXJ0aW5nIHJvd3MsIGFuZCB3aGVuIHRhYmJpbmcgdGhyb3VnaCBjZWxscyAobmVlZCB0byBjaGFuZ2UgdGhpcylcclxuICAgICAgICAvLyBuZWVkIGEgbmV3TWV0aG9kIC0gZ2V0IG5leHQgY29sIGluZGV4XHJcbiAgICAgICAgZ2V0VmlzaWJsZUNvbHVtbnM6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhhdC52aXNpYmxlQ29sdW1ucztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8vIHVzZWQgYnk6XHJcbiAgICAgICAgLy8gKyBhbmd1bGFyR3JpZCAtPiBmb3Igc2V0dGluZyBib2R5IHdpZHRoXHJcbiAgICAgICAgLy8gKyByb3dDb250cm9sbGVyIC0+IHNldHRpbmcgbWFpbiByb3cgd2lkdGhzICh3aGVuIGluc2VydGluZyBhbmQgcmVzaXppbmcpXHJcbiAgICAgICAgZ2V0Qm9keUNvbnRhaW5lcldpZHRoOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoYXQuZ2V0VG90YWxDb2xXaWR0aChmYWxzZSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvLyB1c2VkIGJ5OlxyXG4gICAgICAgIC8vICsgYW5ndWxhckdyaWQgLT4gc2V0dGluZyBwaW5uZWQgYm9keSB3aWR0aFxyXG4gICAgICAgIGdldFBpbm5lZENvbnRhaW5lcldpZHRoOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoYXQuZ2V0VG90YWxDb2xXaWR0aCh0cnVlKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8vIHVzZWQgYnk6XHJcbiAgICAgICAgLy8gKyBoZWFkZXJSZW5kZXJlciAtPiBzZXR0aW5nIHBpbm5lZCBib2R5IHdpZHRoXHJcbiAgICAgICAgZ2V0Q29sdW1uR3JvdXBzOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoYXQuY29sdW1uR3JvdXBzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLy8gdXNlZCBieTpcclxuICAgICAgICAvLyArIHJvd1JlbmRlcmVyIC0+IGZvciBuYXZpZ2F0aW9uXHJcbiAgICAgICAgZ2V0VmlzaWJsZUNvbEJlZm9yZTogZnVuY3Rpb24oY29sKSB7XHJcbiAgICAgICAgICAgIHZhciBvbGRJbmRleCA9IHRoYXQudmlzaWJsZUNvbHVtbnMuaW5kZXhPZihjb2wpO1xyXG4gICAgICAgICAgICBpZiAob2xkSW5kZXggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhhdC52aXNpYmxlQ29sdW1uc1tvbGRJbmRleCAtIDFdO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIC8vIHVzZWQgYnk6XHJcbiAgICAgICAgLy8gKyByb3dSZW5kZXJlciAtPiBmb3IgbmF2aWdhdGlvblxyXG4gICAgICAgIGdldFZpc2libGVDb2xBZnRlcjogZnVuY3Rpb24oY29sKSB7XHJcbiAgICAgICAgICAgIHZhciBvbGRJbmRleCA9IHRoYXQudmlzaWJsZUNvbHVtbnMuaW5kZXhPZihjb2wpO1xyXG4gICAgICAgICAgICBpZiAob2xkSW5kZXggPCAodGhhdC52aXNpYmxlQ29sdW1ucy5sZW5ndGggLSAxKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoYXQudmlzaWJsZUNvbHVtbnNbb2xkSW5kZXggKyAxXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufTtcclxuXHJcbkNvbHVtbkNvbnRyb2xsZXIucHJvdG90eXBlLmdldE1vZGVsID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5tb2RlbDtcclxufTtcclxuXHJcbi8vIGNhbGxlZCBieSBhbmd1bGFyR3JpZFxyXG5Db2x1bW5Db250cm9sbGVyLnByb3RvdHlwZS5zZXRDb2x1bW5zID0gZnVuY3Rpb24oY29sdW1uRGVmcykge1xyXG4gICAgdGhpcy5idWlsZENvbHVtbnMoY29sdW1uRGVmcyk7XHJcbiAgICB0aGlzLmVuc3VyZUVhY2hDb2xIYXNTaXplKCk7XHJcbiAgICB0aGlzLmJ1aWxkR3JvdXBzKCk7XHJcbiAgICB0aGlzLnVwZGF0ZUdyb3VwcygpO1xyXG4gICAgdGhpcy51cGRhdGVWaXNpYmxlQ29sdW1ucygpO1xyXG59O1xyXG5cclxuLy8gY2FsbGVkIGJ5IGhlYWRlclJlbmRlcmVyIC0gd2hlbiBhIGhlYWRlciBpcyBvcGVuZWQgb3IgY2xvc2VkXHJcbkNvbHVtbkNvbnRyb2xsZXIucHJvdG90eXBlLmNvbHVtbkdyb3VwT3BlbmVkID0gZnVuY3Rpb24oZ3JvdXApIHtcclxuICAgIGdyb3VwLmV4cGFuZGVkID0gIWdyb3VwLmV4cGFuZGVkO1xyXG4gICAgdGhpcy51cGRhdGVHcm91cHMoKTtcclxuICAgIHRoaXMudXBkYXRlVmlzaWJsZUNvbHVtbnMoKTtcclxuICAgIHRoaXMuYW5ndWxhckdyaWQucmVmcmVzaEhlYWRlckFuZEJvZHkoKTtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuQ29sdW1uQ29udHJvbGxlci5wcm90b3R5cGUudXBkYXRlVmlzaWJsZUNvbHVtbnMgPSBmdW5jdGlvbigpIHtcclxuICAgIC8vIGlmIG5vdCBncm91cGluZyBieSBoZWFkZXJzLCB0aGVuIGFsbCBjb2x1bW5zIGFyZSB2aXNpYmxlXHJcbiAgICBpZiAoIXRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzR3JvdXBIZWFkZXJzKCkpIHtcclxuICAgICAgICB0aGlzLnZpc2libGVDb2x1bW5zID0gdGhpcy5jb2x1bW5zO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBpZiBncm91cGluZywgdGhlbiBvbmx5IHNob3cgY29sIGFzIHBlciBncm91cCBydWxlc1xyXG4gICAgdGhpcy52aXNpYmxlQ29sdW1ucyA9IFtdO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNvbHVtbkdyb3Vwcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBncm91cCA9IHRoaXMuY29sdW1uR3JvdXBzW2ldO1xyXG4gICAgICAgIGdyb3VwLmFkZFRvVmlzaWJsZUNvbHVtbnModGhpcy52aXNpYmxlQ29sdW1ucyk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vLyBwdWJsaWMgLSBjYWxsZWQgZnJvbSBhcGlcclxuQ29sdW1uQ29udHJvbGxlci5wcm90b3R5cGUuc2l6ZUNvbHVtbnNUb0ZpdCA9IGZ1bmN0aW9uKGdyaWRXaWR0aCkge1xyXG4gICAgLy8gYXZvaWQgZGl2aWRlIGJ5IHplcm9cclxuICAgIGlmIChncmlkV2lkdGggPD0gMCB8fCB0aGlzLnZpc2libGVDb2x1bW5zLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgY29sdW1uU3RhcnRXaWR0aCA9IDA7IC8vIHdpbGwgY29udGFpbiB0aGUgc3RhcnRpbmcgdG90YWwgd2lkdGggb2YgdGhlIGNvbHMgYmVlbiBzcHJlYWRcclxuICAgIHZhciBjb2xzVG9TcHJlYWQgPSBbXTsgLy8gYWxsIHZpc2libGUgY29scywgZXhjZXB0IHRob3NlIHdpdGggYXZvaWRTaXplVG9GaXRcclxuICAgIHZhciB3aWR0aEZvclNwcmVhZGluZyA9IGdyaWRXaWR0aDsgLy8gZ3JpZCB3aWR0aCBtaW51cyB0aGUgY29sdW1ucyB3ZSBhcmUgbm90IHJlc2l6aW5nXHJcblxyXG4gICAgLy8gZ2V0IHRoZSBsaXN0IG9mIGNvbHMgdG8gd29yayB3aXRoXHJcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IHRoaXMudmlzaWJsZUNvbHVtbnMubGVuZ3RoIDsgaisrKSB7XHJcbiAgICAgICAgaWYgKHRoaXMudmlzaWJsZUNvbHVtbnNbal0uY29sRGVmLnN1cHByZXNzU2l6ZVRvRml0ID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIC8vIGRvbid0IGluY2x1ZGUgY29sLCBhbmQgcmVtb3ZlIHRoZSB3aWR0aCBmcm9tIHRlaCBhdmFpbGFibGUgd2lkdGhcclxuICAgICAgICAgICAgd2lkdGhGb3JTcHJlYWRpbmcgLT0gdGhpcy52aXNpYmxlQ29sdW1uc1tqXS5hY3R1YWxXaWR0aDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBpbmNsdWRlIHRoZSBjb2xcclxuICAgICAgICAgICAgY29sc1RvU3ByZWFkLnB1c2godGhpcy52aXNpYmxlQ29sdW1uc1tqXSk7XHJcbiAgICAgICAgICAgIGNvbHVtblN0YXJ0V2lkdGggKz0gdGhpcy52aXNpYmxlQ29sdW1uc1tqXS5hY3R1YWxXaWR0aDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gaWYgbm8gd2lkdGggbGVmdCBvdmVyIHRvIHNwcmVhZCB3aXRoLCBkbyBub3RoaW5nXHJcbiAgICBpZiAod2lkdGhGb3JTcHJlYWRpbmcgPD0gMCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgc2NhbGUgPSB3aWR0aEZvclNwcmVhZGluZyAvIGNvbHVtblN0YXJ0V2lkdGg7XHJcbiAgICB2YXIgcGl4ZWxzRm9yTGFzdENvbCA9IHdpZHRoRm9yU3ByZWFkaW5nO1xyXG5cclxuICAgIC8vIHNpemUgYWxsIGNvbHMgZXhjZXB0IHRoZSBsYXN0IGJ5IHRoZSBzY2FsZVxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCAoY29sc1RvU3ByZWFkLmxlbmd0aCAtIDEpOyBpKyspIHtcclxuICAgICAgICB2YXIgY29sdW1uID0gY29sc1RvU3ByZWFkW2ldO1xyXG4gICAgICAgIHZhciBuZXdXaWR0aCA9IHBhcnNlSW50KGNvbHVtbi5hY3R1YWxXaWR0aCAqIHNjYWxlKTtcclxuICAgICAgICBjb2x1bW4uYWN0dWFsV2lkdGggPSBuZXdXaWR0aDtcclxuICAgICAgICBwaXhlbHNGb3JMYXN0Q29sIC09IG5ld1dpZHRoO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIHNpemUgdGhlIGxhc3QgYnkgd2hhdHMgcmVtYWluaW5nICh0aGlzIGF2b2lkcyByb3VuZGluZyBlcnJvcnMgdGhhdCBjb3VsZFxyXG4gICAgLy8gb2NjdXIgd2l0aCBzY2FsaW5nIGV2ZXJ5dGhpbmcsIHdoZXJlIGl0IHJlc3VsdCBpbiBzb21lIHBpeGVscyBvZmYpXHJcbiAgICB2YXIgbGFzdENvbHVtbiA9IGNvbHNUb1NwcmVhZFtjb2xzVG9TcHJlYWQubGVuZ3RoIC0gMV07XHJcbiAgICBsYXN0Q29sdW1uLmFjdHVhbFdpZHRoID0gcGl4ZWxzRm9yTGFzdENvbDtcclxuXHJcbiAgICAvLyB3aWR0aHMgc2V0LCByZWZyZXNoIHRoZSBndWlcclxuICAgIHRoaXMuYW5ndWxhckdyaWQucmVmcmVzaEhlYWRlckFuZEJvZHkoKTtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuQ29sdW1uQ29udHJvbGxlci5wcm90b3R5cGUuYnVpbGRHcm91cHMgPSBmdW5jdGlvbigpIHtcclxuICAgIC8vIGlmIG5vdCBncm91cGluZyBieSBoZWFkZXJzLCBkbyBub3RoaW5nXHJcbiAgICBpZiAoIXRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzR3JvdXBIZWFkZXJzKCkpIHtcclxuICAgICAgICB0aGlzLmNvbHVtbkdyb3VwcyA9IG51bGw7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIHNwbGl0IHRoZSBjb2x1bW5zIGludG8gZ3JvdXBzXHJcbiAgICB2YXIgY3VycmVudEdyb3VwID0gbnVsbDtcclxuICAgIHRoaXMuY29sdW1uR3JvdXBzID0gW107XHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcblxyXG4gICAgdmFyIGxhc3RDb2xXYXNQaW5uZWQgPSB0cnVlO1xyXG5cclxuICAgIHRoaXMuY29sdW1ucy5mb3JFYWNoKGZ1bmN0aW9uKGNvbHVtbikge1xyXG4gICAgICAgIC8vIGRvIHdlIG5lZWQgYSBuZXcgZ3JvdXAsIGJlY2F1c2Ugd2UgbW92ZSBmcm9tIHBpbm5lZCB0byBub24tcGlubmVkIGNvbHVtbnM/XHJcbiAgICAgICAgdmFyIGVuZE9mUGlubmVkSGVhZGVyID0gbGFzdENvbFdhc1Bpbm5lZCAmJiAhY29sdW1uLnBpbm5lZDtcclxuICAgICAgICBpZiAoIWNvbHVtbi5waW5uZWQpIHtcclxuICAgICAgICAgICAgbGFzdENvbFdhc1Bpbm5lZCA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBkbyB3ZSBuZWVkIGEgbmV3IGdyb3VwLCBiZWNhdXNlIHRoZSBncm91cCBuYW1lcyBkb2Vzbid0IG1hdGNoIGZyb20gcHJldmlvdXMgY29sP1xyXG4gICAgICAgIHZhciBncm91cEtleU1pc21hdGNoID0gY3VycmVudEdyb3VwICYmIGNvbHVtbi5jb2xEZWYuZ3JvdXAgIT09IGN1cnJlbnRHcm91cC5uYW1lO1xyXG4gICAgICAgIC8vIHdlIGRvbid0IGdyb3VwIGNvbHVtbnMgd2hlcmUgbm8gZ3JvdXAgaXMgc3BlY2lmaWVkXHJcbiAgICAgICAgdmFyIGNvbE5vdEluR3JvdXAgPSBjdXJyZW50R3JvdXAgJiYgIWN1cnJlbnRHcm91cC5uYW1lO1xyXG4gICAgICAgIC8vIGRvIHdlIG5lZWQgYSBuZXcgZ3JvdXAsIGJlY2F1c2Ugd2UgYXJlIGp1c3Qgc3RhcnRpbmdcclxuICAgICAgICB2YXIgcHJvY2Vzc2luZ0ZpcnN0Q29sID0gY29sdW1uLmluZGV4ID09PSAwO1xyXG4gICAgICAgIHZhciBuZXdHcm91cE5lZWRlZCA9IHByb2Nlc3NpbmdGaXJzdENvbCB8fCBlbmRPZlBpbm5lZEhlYWRlciB8fCBncm91cEtleU1pc21hdGNoIHx8IGNvbE5vdEluR3JvdXA7XHJcbiAgICAgICAgLy8gY3JlYXRlIG5ldyBncm91cCwgaWYgaXQncyBuZWVkZWRcclxuICAgICAgICBpZiAobmV3R3JvdXBOZWVkZWQpIHtcclxuICAgICAgICAgICAgdmFyIHBpbm5lZCA9IGNvbHVtbi5waW5uZWQ7XHJcbiAgICAgICAgICAgIGN1cnJlbnRHcm91cCA9IG5ldyBDb2x1bW5Hcm91cChwaW5uZWQsIGNvbHVtbi5jb2xEZWYuZ3JvdXApO1xyXG4gICAgICAgICAgICB0aGF0LmNvbHVtbkdyb3Vwcy5wdXNoKGN1cnJlbnRHcm91cCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGN1cnJlbnRHcm91cC5hZGRDb2x1bW4oY29sdW1uKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxuLy8gcHJpdmF0ZVxyXG5Db2x1bW5Db250cm9sbGVyLnByb3RvdHlwZS51cGRhdGVHcm91cHMgPSBmdW5jdGlvbigpIHtcclxuICAgIC8vIGlmIG5vdCBncm91cGluZyBieSBoZWFkZXJzLCBkbyBub3RoaW5nXHJcbiAgICBpZiAoIXRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzR3JvdXBIZWFkZXJzKCkpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNvbHVtbkdyb3Vwcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBncm91cCA9IHRoaXMuY29sdW1uR3JvdXBzW2ldO1xyXG4gICAgICAgIGdyb3VwLmNhbGN1bGF0ZUV4cGFuZGFibGUoKTtcclxuICAgICAgICBncm91cC5jYWxjdWxhdGVWaXNpYmxlQ29sdW1ucygpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLy8gcHJpdmF0ZVxyXG5Db2x1bW5Db250cm9sbGVyLnByb3RvdHlwZS5idWlsZENvbHVtbnMgPSBmdW5jdGlvbihjb2x1bW5EZWZzKSB7XHJcbiAgICB0aGlzLmNvbHVtbnMgPSBbXTtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIHZhciBwaW5uZWRDb2x1bW5Db3VudCA9IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldFBpbm5lZENvbENvdW50KCk7XHJcbiAgICBpZiAoY29sdW1uRGVmcykge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29sdW1uRGVmcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgY29sRGVmID0gY29sdW1uRGVmc1tpXTtcclxuICAgICAgICAgICAgLy8gdGhpcyBpcyBtZXNzeSAtIHdlIHN3YXAgaW4gYW5vdGhlciBjb2wgZGVmIGlmIGl0J3MgY2hlY2tib3ggc2VsZWN0aW9uIC0gbm90IGhhcHB5IDooXHJcbiAgICAgICAgICAgIGlmIChjb2xEZWYgPT09ICdjaGVja2JveFNlbGVjdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGNvbERlZiA9IHRoYXQuc2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5LmNyZWF0ZUNoZWNrYm94Q29sRGVmKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIHBpbm5lZCA9IHBpbm5lZENvbHVtbkNvdW50ID4gaTtcclxuICAgICAgICAgICAgdmFyIGNvbHVtbiA9IG5ldyBDb2x1bW4oY29sRGVmLCBpLCBwaW5uZWQpO1xyXG4gICAgICAgICAgICB0aGF0LmNvbHVtbnMucHVzaChjb2x1bW4pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuLy8gc2V0IHRoZSBhY3R1YWwgd2lkdGhzIGZvciBlYWNoIGNvbFxyXG5Db2x1bW5Db250cm9sbGVyLnByb3RvdHlwZS5lbnN1cmVFYWNoQ29sSGFzU2l6ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGRlZmF1bHRXaWR0aCA9IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldENvbFdpZHRoKCk7XHJcbiAgICBpZiAodHlwZW9mIGRlZmF1bHRXaWR0aCAhPT0gJ251bWJlcicgfHwgZGVmYXVsdFdpZHRoIDwgY29uc3RhbnRzLk1JTl9DT0xfV0lEVEgpIHtcclxuICAgICAgICBkZWZhdWx0V2lkdGggPSAyMDA7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNvbHVtbnMuZm9yRWFjaChmdW5jdGlvbihjb2xEZWZXcmFwcGVyKSB7XHJcbiAgICAgICAgdmFyIGNvbERlZiA9IGNvbERlZldyYXBwZXIuY29sRGVmO1xyXG4gICAgICAgIGlmIChjb2xEZWZXcmFwcGVyLmFjdHVhbFdpZHRoKSB7XHJcbiAgICAgICAgICAgIC8vIGlmIGFjdHVhbCB3aWR0aCBhbHJlYWR5IHNldCwgZG8gbm90aGluZ1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfSBlbHNlIGlmICghY29sRGVmLndpZHRoKSB7XHJcbiAgICAgICAgICAgIC8vIGlmIG5vIHdpZHRoIGRlZmluZWQgaW4gY29sRGVmLCBkZWZhdWx0IHRvIDIwMFxyXG4gICAgICAgICAgICBjb2xEZWZXcmFwcGVyLmFjdHVhbFdpZHRoID0gZGVmYXVsdFdpZHRoO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoY29sRGVmLndpZHRoIDwgY29uc3RhbnRzLk1JTl9DT0xfV0lEVEgpIHtcclxuICAgICAgICAgICAgLy8gaWYgd2lkdGggaW4gY29sIGRlZiB0byBzbWFsbCwgc2V0IHRvIG1pbiB3aWR0aFxyXG4gICAgICAgICAgICBjb2xEZWZXcmFwcGVyLmFjdHVhbFdpZHRoID0gY29uc3RhbnRzLk1JTl9DT0xfV0lEVEg7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIHVzZSB0aGUgcHJvdmlkZWQgd2lkdGhcclxuICAgICAgICAgICAgY29sRGVmV3JhcHBlci5hY3R1YWxXaWR0aCA9IGNvbERlZi53aWR0aDtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuLy8gY2FsbCB3aXRoIHRydWUgKHBpbm5lZCksIGZhbHNlIChub3QtcGlubmVkKSBvciB1bmRlZmluZWQgKGFsbCBjb2x1bW5zKVxyXG5Db2x1bW5Db250cm9sbGVyLnByb3RvdHlwZS5nZXRUb3RhbENvbFdpZHRoID0gZnVuY3Rpb24oaW5jbHVkZVBpbm5lZCkge1xyXG4gICAgdmFyIHdpZHRoU29GYXIgPSAwO1xyXG4gICAgdmFyIHBpbmVkTm90SW1wb3J0YW50ID0gdHlwZW9mIGluY2x1ZGVQaW5uZWQgIT09ICdib29sZWFuJztcclxuXHJcbiAgICB0aGlzLnZpc2libGVDb2x1bW5zLmZvckVhY2goZnVuY3Rpb24oY29sdW1uKSB7XHJcbiAgICAgICAgdmFyIGluY2x1ZGVUaGlzQ29sID0gcGluZWROb3RJbXBvcnRhbnQgfHwgY29sdW1uLnBpbm5lZCA9PT0gaW5jbHVkZVBpbm5lZDtcclxuICAgICAgICBpZiAoaW5jbHVkZVRoaXNDb2wpIHtcclxuICAgICAgICAgICAgd2lkdGhTb0ZhciArPSBjb2x1bW4uYWN0dWFsV2lkdGg7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHdpZHRoU29GYXI7XHJcbn07XHJcblxyXG5mdW5jdGlvbiBDb2x1bW5Hcm91cChwaW5uZWQsIG5hbWUpIHtcclxuICAgIHRoaXMucGlubmVkID0gcGlubmVkO1xyXG4gICAgdGhpcy5uYW1lID0gbmFtZTtcclxuICAgIHRoaXMuYWxsQ29sdW1ucyA9IFtdO1xyXG4gICAgdGhpcy52aXNpYmxlQ29sdW1ucyA9IFtdO1xyXG4gICAgdGhpcy5leHBhbmRhYmxlID0gZmFsc2U7IC8vIHdoZXRoZXIgdGhpcyBncm91cCBjYW4gYmUgZXhwYW5kZWQgb3Igbm90XHJcbiAgICB0aGlzLmV4cGFuZGVkID0gZmFsc2U7XHJcbn1cclxuXHJcbkNvbHVtbkdyb3VwLnByb3RvdHlwZS5hZGRDb2x1bW4gPSBmdW5jdGlvbihjb2x1bW4pIHtcclxuICAgIHRoaXMuYWxsQ29sdW1ucy5wdXNoKGNvbHVtbik7XHJcbn07XHJcblxyXG4vLyBuZWVkIHRvIGNoZWNrIHRoYXQgdGhpcyBncm91cCBoYXMgYXQgbGVhc3Qgb25lIGNvbCBzaG93aW5nIHdoZW4gYm90aCBleHBhbmRlZCBhbmQgY29udHJhY3RlZC5cclxuLy8gaWYgbm90LCB0aGVuIHdlIGRvbid0IGFsbG93IGV4cGFuZGluZyBhbmQgY29udHJhY3Rpbmcgb24gdGhpcyBncm91cFxyXG5Db2x1bW5Hcm91cC5wcm90b3R5cGUuY2FsY3VsYXRlRXhwYW5kYWJsZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgLy8gd2FudCB0byBtYWtlIHN1cmUgdGhlIGdyb3VwIGRvZXNuJ3QgZGlzYXBwZWFyIHdoZW4gaXQncyBvcGVuXHJcbiAgICB2YXIgYXRMZWFzdE9uZVNob3dpbmdXaGVuT3BlbiA9IGZhbHNlO1xyXG4gICAgLy8gd2FudCB0byBtYWtlIHN1cmUgdGhlIGdyb3VwIGRvZXNuJ3QgZGlzYXBwZWFyIHdoZW4gaXQncyBjbG9zZWRcclxuICAgIHZhciBhdExlYXN0T25lU2hvd2luZ1doZW5DbG9zZWQgPSBmYWxzZTtcclxuICAgIC8vIHdhbnQgdG8gbWFrZSBzdXJlIHRoZSBncm91cCBoYXMgc29tZXRoaW5nIHRvIHNob3cgLyBoaWRlXHJcbiAgICB2YXIgYXRMZWFzdE9uZUNoYW5nZWFibGUgPSBmYWxzZTtcclxuICAgIGZvciAodmFyIGkgPSAwLCBqID0gdGhpcy5hbGxDb2x1bW5zLmxlbmd0aDsgaSA8IGo7IGkrKykge1xyXG4gICAgICAgIHZhciBjb2x1bW4gPSB0aGlzLmFsbENvbHVtbnNbaV07XHJcbiAgICAgICAgaWYgKGNvbHVtbi5jb2xEZWYuZ3JvdXBTaG93ID09PSAnb3BlbicpIHtcclxuICAgICAgICAgICAgYXRMZWFzdE9uZVNob3dpbmdXaGVuT3BlbiA9IHRydWU7XHJcbiAgICAgICAgICAgIGF0TGVhc3RPbmVDaGFuZ2VhYmxlID0gdHJ1ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKGNvbHVtbi5jb2xEZWYuZ3JvdXBTaG93ID09PSAnY2xvc2VkJykge1xyXG4gICAgICAgICAgICBhdExlYXN0T25lU2hvd2luZ1doZW5DbG9zZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICBhdExlYXN0T25lQ2hhbmdlYWJsZSA9IHRydWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYXRMZWFzdE9uZVNob3dpbmdXaGVuT3BlbiA9IHRydWU7XHJcbiAgICAgICAgICAgIGF0TGVhc3RPbmVTaG93aW5nV2hlbkNsb3NlZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZXhwYW5kYWJsZSA9IGF0TGVhc3RPbmVTaG93aW5nV2hlbk9wZW4gJiYgYXRMZWFzdE9uZVNob3dpbmdXaGVuQ2xvc2VkICYmIGF0TGVhc3RPbmVDaGFuZ2VhYmxlO1xyXG59O1xyXG5cclxuQ29sdW1uR3JvdXAucHJvdG90eXBlLmNhbGN1bGF0ZVZpc2libGVDb2x1bW5zID0gZnVuY3Rpb24oKSB7XHJcbiAgICAvLyBjbGVhciBvdXQgbGFzdCB0aW1lIHdlIGNhbGN1bGF0ZWRcclxuICAgIHRoaXMudmlzaWJsZUNvbHVtbnMgPSBbXTtcclxuICAgIC8vIGl0IG5vdCBleHBhbmRhYmxlLCBldmVyeXRoaW5nIGlzIHZpc2libGVcclxuICAgIGlmICghdGhpcy5leHBhbmRhYmxlKSB7XHJcbiAgICAgICAgdGhpcy52aXNpYmxlQ29sdW1ucyA9IHRoaXMuYWxsQ29sdW1ucztcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICAvLyBhbmQgY2FsY3VsYXRlIGFnYWluXHJcbiAgICBmb3IgKHZhciBpID0gMCwgaiA9IHRoaXMuYWxsQ29sdW1ucy5sZW5ndGg7IGkgPCBqOyBpKyspIHtcclxuICAgICAgICB2YXIgY29sdW1uID0gdGhpcy5hbGxDb2x1bW5zW2ldO1xyXG4gICAgICAgIHN3aXRjaCAoY29sdW1uLmNvbERlZi5ncm91cFNob3cpIHtcclxuICAgICAgICAgICAgY2FzZSAnb3Blbic6XHJcbiAgICAgICAgICAgICAgICAvLyB3aGVuIHNldCB0byBvcGVuLCBvbmx5IHNob3cgY29sIGlmIGdyb3VwIGlzIG9wZW5cclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmV4cGFuZGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52aXNpYmxlQ29sdW1ucy5wdXNoKGNvbHVtbik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnY2xvc2VkJzpcclxuICAgICAgICAgICAgICAgIC8vIHdoZW4gc2V0IHRvIG9wZW4sIG9ubHkgc2hvdyBjb2wgaWYgZ3JvdXAgaXMgb3BlblxyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmV4cGFuZGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52aXNpYmxlQ29sdW1ucy5wdXNoKGNvbHVtbik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgaXMgYWx3YXlzIHNob3cgdGhlIGNvbHVtblxyXG4gICAgICAgICAgICAgICAgdGhpcy52aXNpYmxlQ29sdW1ucy5wdXNoKGNvbHVtbik7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcblxyXG5Db2x1bW5Hcm91cC5wcm90b3R5cGUuYWRkVG9WaXNpYmxlQ29sdW1ucyA9IGZ1bmN0aW9uKGFsbFZpc2libGVDb2x1bW5zKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudmlzaWJsZUNvbHVtbnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YXIgY29sdW1uID0gdGhpcy52aXNpYmxlQ29sdW1uc1tpXTtcclxuICAgICAgICBhbGxWaXNpYmxlQ29sdW1ucy5wdXNoKGNvbHVtbik7XHJcbiAgICB9XHJcbn07XHJcblxyXG5mdW5jdGlvbiBDb2x1bW4oY29sRGVmLCBpbmRleCwgcGlubmVkKSB7XHJcbiAgICB0aGlzLmNvbERlZiA9IGNvbERlZjtcclxuICAgIHRoaXMuaW5kZXggPSBpbmRleDtcclxuICAgIHRoaXMucGlubmVkID0gcGlubmVkO1xyXG4gICAgLy8gaW4gdGhlIGZ1dHVyZSwgdGhlIGNvbEtleSBtaWdodCBiZSBzb21ldGhpbmcgb3RoZXIgdGhhbiB0aGUgaW5kZXhcclxuICAgIHRoaXMuY29sS2V5ID0gaW5kZXg7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ29sdW1uQ29udHJvbGxlcjtcclxuIiwidmFyIGNvbnN0YW50cyA9IHtcclxuICAgIFNURVBfRVZFUllUSElORzogMCxcclxuICAgIFNURVBfRklMVEVSOiAxLFxyXG4gICAgU1RFUF9TT1JUOiAyLFxyXG4gICAgU1RFUF9NQVA6IDMsXHJcbiAgICBBU0M6IFwiYXNjXCIsXHJcbiAgICBERVNDOiBcImRlc2NcIixcclxuICAgIFJPV19CVUZGRVJfU0laRTogMjAsXHJcbiAgICBTT1JUX1NUWUxFX1NIT1c6IFwiZGlzcGxheTppbmxpbmU7XCIsXHJcbiAgICBTT1JUX1NUWUxFX0hJREU6IFwiZGlzcGxheTpub25lO1wiLFxyXG4gICAgTUlOX0NPTF9XSURUSDogMTBcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gY29uc3RhbnRzO1xyXG4iLCJmdW5jdGlvbiBFeHByZXNzaW9uU2VydmljZSgpIHt9XHJcblxyXG5FeHByZXNzaW9uU2VydmljZS5wcm90b3R5cGUuZXZhbHVhdGUgPSBmdW5jdGlvbihydWxlLCBwYXJhbXMpIHtcclxufTtcclxuXHJcbmZ1bmN0aW9uIEV4cHJlc3Npb25TZXJ2aWNlKCkge1xyXG4gICAgdGhpcy5leHByZXNzaW9uVG9GdW5jdGlvbkNhY2hlID0ge307XHJcbn1cclxuXHJcbkV4cHJlc3Npb25TZXJ2aWNlLnByb3RvdHlwZS5ldmFsdWF0ZSA9IGZ1bmN0aW9uIChleHByZXNzaW9uLCBwYXJhbXMpIHtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAgIHZhciBqYXZhU2NyaXB0RnVuY3Rpb24gPSB0aGlzLmNyZWF0ZUV4cHJlc3Npb25GdW5jdGlvbihleHByZXNzaW9uKTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gamF2YVNjcmlwdEZ1bmN0aW9uKHBhcmFtcy52YWx1ZSwgcGFyYW1zLmNvbnRleHQsIHBhcmFtcy5ub2RlLFxyXG4gICAgICAgICAgICBwYXJhbXMuZGF0YSwgcGFyYW1zLmNvbERlZiwgcGFyYW1zLnJvd0luZGV4LCBwYXJhbXMuYXBpKTtcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIC8vIHRoZSBleHByZXNzaW9uIGZhaWxlZCwgd2hpY2ggY2FuIGhhcHBlbiwgYXMgaXQncyB0aGUgY2xpZW50IHRoYXRcclxuICAgICAgICAvLyBwcm92aWRlcyB0aGUgZXhwcmVzc2lvbi4gc28gcHJpbnQgYSBuaWNlIG1lc3NhZ2VcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdQcm9jZXNzaW5nIG9mIHRoZSBleHByZXNzaW9uIGZhaWxlZCcpO1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0V4cHJlc3Npb24gPSAnICsgZXhwcmVzc2lvbik7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignRXhjZXB0aW9uID0gJyArIGUpO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG59O1xyXG5cclxuRXhwcmVzc2lvblNlcnZpY2UucHJvdG90eXBlLmNyZWF0ZUV4cHJlc3Npb25GdW5jdGlvbiA9IGZ1bmN0aW9uIChleHByZXNzaW9uKSB7XHJcbiAgICAvLyBjaGVjayBjYWNoZSBmaXJzdFxyXG4gICAgaWYgKHRoaXMuZXhwcmVzc2lvblRvRnVuY3Rpb25DYWNoZVtleHByZXNzaW9uXSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmV4cHJlc3Npb25Ub0Z1bmN0aW9uQ2FjaGVbZXhwcmVzc2lvbl07XHJcbiAgICB9XHJcbiAgICAvLyBpZiBub3QgZm91bmQgaW4gY2FjaGUsIHJldHVybiB0aGUgZnVuY3Rpb25cclxuICAgIHZhciBmdW5jdGlvbkJvZHkgPSB0aGlzLmNyZWF0ZUZ1bmN0aW9uQm9keShleHByZXNzaW9uKTtcclxuICAgIHZhciB0aGVGdW5jdGlvbiA9IG5ldyBGdW5jdGlvbigneCwgY3R4LCBub2RlLCBkYXRhLCBjb2xEZWYsIHJvd0luZGV4LCBhcGknLCBmdW5jdGlvbkJvZHkpO1xyXG5cclxuICAgIC8vIHN0b3JlIGluIGNhY2hlXHJcbiAgICB0aGlzLmV4cHJlc3Npb25Ub0Z1bmN0aW9uQ2FjaGVbZXhwcmVzc2lvbl0gPSB0aGVGdW5jdGlvbjtcclxuXHJcbiAgICByZXR1cm4gdGhlRnVuY3Rpb247XHJcbn07XHJcblxyXG5FeHByZXNzaW9uU2VydmljZS5wcm90b3R5cGUuY3JlYXRlRnVuY3Rpb25Cb2R5ID0gZnVuY3Rpb24gKGV4cHJlc3Npb24pIHtcclxuICAgIC8vIGlmIHRoZSBleHByZXNzaW9uIGhhcyB0aGUgJ3JldHVybicgd29yZCBpbiBpdCwgdGhlbiB1c2UgYXMgaXMsXHJcbiAgICAvLyBpZiBub3QsIHRoZW4gd3JhcCBpdCB3aXRoIHJldHVybiBhbmQgJzsnIHRvIG1ha2UgYSBmdW5jdGlvblxyXG4gICAgaWYgKGV4cHJlc3Npb24uaW5kZXhPZigncmV0dXJuJykgPj0gMCkge1xyXG4gICAgICAgIHJldHVybiBleHByZXNzaW9uO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gJ3JldHVybiAnICsgZXhwcmVzc2lvbiArICc7JztcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRXhwcmVzc2lvblNlcnZpY2U7XHJcbiIsInZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcclxudmFyIFNldEZpbHRlciA9IHJlcXVpcmUoJy4vc2V0RmlsdGVyJyk7XHJcbnZhciBOdW1iZXJGaWx0ZXIgPSByZXF1aXJlKCcuL251bWJlckZpbHRlcicpO1xyXG52YXIgU3RyaW5nRmlsdGVyID0gcmVxdWlyZSgnLi90ZXh0RmlsdGVyJyk7XHJcblxyXG5mdW5jdGlvbiBGaWx0ZXJNYW5hZ2VyKCkge31cclxuXHJcbkZpbHRlck1hbmFnZXIucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbihncmlkLCBncmlkT3B0aW9uc1dyYXBwZXIsICRjb21waWxlLCAkc2NvcGUpIHtcclxuICAgIHRoaXMuJGNvbXBpbGUgPSAkY29tcGlsZTtcclxuICAgIHRoaXMuJHNjb3BlID0gJHNjb3BlO1xyXG4gICAgdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIgPSBncmlkT3B0aW9uc1dyYXBwZXI7XHJcbiAgICB0aGlzLmdyaWQgPSBncmlkO1xyXG4gICAgdGhpcy5hbGxGaWx0ZXJzID0ge307XHJcbn07XHJcblxyXG5GaWx0ZXJNYW5hZ2VyLnByb3RvdHlwZS5zZXRSb3dNb2RlbCA9IGZ1bmN0aW9uKHJvd01vZGVsKSB7XHJcbiAgICB0aGlzLnJvd01vZGVsID0gcm93TW9kZWw7XHJcbn07XHJcblxyXG5GaWx0ZXJNYW5hZ2VyLnByb3RvdHlwZS5jcmVhdGVGaWx0ZXIgPSBmdW5jdGlvbihjb2xEZWZXcmFwcGVyKXtcclxuICAgIHZhciBmaWx0ZXJXcmFwcGVyID0gdGhpcy5hbGxGaWx0ZXJzW2NvbERlZldyYXBwZXIuY29sS2V5XTtcclxuICAgIHZhciBjb2xEZWYgPSBjb2xEZWZXcmFwcGVyLmNvbERlZjtcclxuXHJcbiAgICBpZiAoIWZpbHRlcldyYXBwZXIpIHtcclxuICAgICAgICBmaWx0ZXJXcmFwcGVyID0ge1xyXG4gICAgICAgICAgICBjb2xLZXk6IGNvbERlZldyYXBwZXIuY29sS2V5LFxyXG4gICAgICAgICAgICBmaWVsZDogY29sRGVmLmZpZWxkXHJcbiAgICAgICAgfTtcclxuICAgICAgICB2YXIgZmlsdGVyQ2hhbmdlZENhbGxiYWNrID0gdGhpcy5ncmlkLm9uRmlsdGVyQ2hhbmdlZC5iaW5kKHRoaXMuZ3JpZCk7XHJcbiAgICAgICAgdmFyIGZpbHRlclBhcmFtcyA9IGNvbERlZi5maWx0ZXJQYXJhbXM7XHJcbiAgICAgICAgdmFyIHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgY29sRGVmOiBjb2xEZWYsXHJcbiAgICAgICAgICAgIHJvd01vZGVsOiB0aGlzLnJvd01vZGVsLFxyXG4gICAgICAgICAgICBmaWx0ZXJDaGFuZ2VkQ2FsbGJhY2s6IGZpbHRlckNoYW5nZWRDYWxsYmFjayxcclxuICAgICAgICAgICAgZmlsdGVyUGFyYW1zOiBmaWx0ZXJQYXJhbXMsXHJcbiAgICAgICAgICAgIHNjb3BlOiBmaWx0ZXJXcmFwcGVyLnNjb3BlXHJcbiAgICAgICAgfTtcclxuICAgICAgICBpZiAodHlwZW9mIGNvbERlZi5maWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgLy8gaWYgdXNlciBwcm92aWRlZCBhIGZpbHRlciwganVzdCB1c2UgaXRcclxuICAgICAgICAgICAgLy8gZmlyc3QgdXAsIGNyZWF0ZSBjaGlsZCBzY29wZSBpZiBuZWVkZWRcclxuICAgICAgICAgICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzQW5ndWxhckNvbXBpbGVGaWx0ZXJzKCkpIHtcclxuICAgICAgICAgICAgICAgIHZhciBzY29wZSA9IHRoaXMuJHNjb3BlLiRuZXcoKTtcclxuICAgICAgICAgICAgICAgIGZpbHRlcldyYXBwZXIuc2NvcGUgPSBzY29wZTtcclxuICAgICAgICAgICAgICAgIHBhcmFtcy4kc2NvcGUgPSBzY29wZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBub3cgY3JlYXRlIGZpbHRlclxyXG4gICAgICAgICAgICBmaWx0ZXJXcmFwcGVyLmZpbHRlciA9IG5ldyBjb2xEZWYuZmlsdGVyKHBhcmFtcyk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChjb2xEZWYuZmlsdGVyID09PSAndGV4dCcpIHtcclxuICAgICAgICAgICAgZmlsdGVyV3JhcHBlci5maWx0ZXIgPSBuZXcgU3RyaW5nRmlsdGVyKHBhcmFtcyk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChjb2xEZWYuZmlsdGVyID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICBmaWx0ZXJXcmFwcGVyLmZpbHRlciA9IG5ldyBOdW1iZXJGaWx0ZXIocGFyYW1zKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBmaWx0ZXJXcmFwcGVyLmZpbHRlciA9IG5ldyBTZXRGaWx0ZXIocGFyYW1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5hbGxGaWx0ZXJzW2NvbERlZldyYXBwZXIuY29sS2V5XSA9IGZpbHRlcldyYXBwZXI7XHJcblxyXG4gICAgICAgIGlmICghZmlsdGVyV3JhcHBlci5maWx0ZXIuZ2V0R3VpKSB7IC8vIGJlY2F1c2UgdXNlcnMgY2FuIGRvIGN1c3RvbSBmaWx0ZXJzLCBnaXZlIG5pY2UgZXJyb3IgbWVzc2FnZVxyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGaWx0ZXIgaXMgbWlzc2luZyBtZXRob2QgZ2V0R3VpJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgZUZpbHRlckd1aSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIGVGaWx0ZXJHdWkuY2xhc3NOYW1lID0gJ2FnLWZpbHRlcic7XHJcbiAgICAgICAgdmFyIGd1aUZyb21GaWx0ZXIgPSBmaWx0ZXJXcmFwcGVyLmZpbHRlci5nZXRHdWkoKTtcclxuICAgICAgICBpZiAodXRpbHMuaXNOb2RlT3JFbGVtZW50KGd1aUZyb21GaWx0ZXIpKSB7XHJcbiAgICAgICAgICAgIC8vYSBkb20gbm9kZSBvciBlbGVtZW50IHdhcyByZXR1cm5lZCwgc28gYWRkIGNoaWxkXHJcbiAgICAgICAgICAgIGVGaWx0ZXJHdWkuYXBwZW5kQ2hpbGQoZ3VpRnJvbUZpbHRlcik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy9vdGhlcndpc2UgYXNzdW1lIGl0IHdhcyBodG1sLCBzbyBqdXN0IGluc2VydFxyXG4gICAgICAgICAgICB2YXIgZVRleHRTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgICAgICAgICBlVGV4dFNwYW4uaW5uZXJIVE1MID0gZ3VpRnJvbUZpbHRlcjtcclxuICAgICAgICAgICAgZUZpbHRlckd1aS5hcHBlbmRDaGlsZChlVGV4dFNwYW4pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGZpbHRlcldyYXBwZXIuc2NvcGUpIHtcclxuICAgICAgICAgICAgZmlsdGVyV3JhcHBlci5ndWkgPSB0aGlzLiRjb21waWxlKGVGaWx0ZXJHdWkpKGZpbHRlcldyYXBwZXIuc2NvcGUpWzBdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGZpbHRlcldyYXBwZXIuZ3VpID0gZUZpbHRlckd1aTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG59O1xyXG5cclxuLy8gcmV0dXJucyB0cnVlIGlmIGF0IGxlYXN0IG9uZSBmaWx0ZXIgaXMgYWN0aXZlXHJcbkZpbHRlck1hbmFnZXIucHJvdG90eXBlLmlzRmlsdGVyUHJlc2VudCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGF0TGVhc3RPbmVBY3RpdmUgPSBmYWxzZTtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuXHJcbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuYWxsRmlsdGVycyk7XHJcbiAgICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XHJcbiAgICAgICAgdmFyIGZpbHRlcldyYXBwZXIgPSB0aGF0LmFsbEZpbHRlcnNba2V5XTtcclxuICAgICAgICBpZiAoIWZpbHRlcldyYXBwZXIuZmlsdGVyLmlzRmlsdGVyQWN0aXZlKSB7IC8vIGJlY2F1c2UgdXNlcnMgY2FuIGRvIGN1c3RvbSBmaWx0ZXJzLCBnaXZlIG5pY2UgZXJyb3IgbWVzc2FnZVxyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGaWx0ZXIgaXMgbWlzc2luZyBtZXRob2QgaXNGaWx0ZXJBY3RpdmUnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGZpbHRlcldyYXBwZXIuZmlsdGVyLmlzRmlsdGVyQWN0aXZlKCkpIHtcclxuICAgICAgICAgICAgYXRMZWFzdE9uZUFjdGl2ZSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gYXRMZWFzdE9uZUFjdGl2ZTtcclxufTtcclxuXHJcbi8vIHJldHVybnMgdHJ1ZSBpZiBnaXZlbiBjb2wgaGFzIGEgZmlsdGVyIGFjdGl2ZVxyXG5GaWx0ZXJNYW5hZ2VyLnByb3RvdHlwZS5pc0ZpbHRlclByZXNlbnRGb3JDb2wgPSBmdW5jdGlvbihjb2xLZXkpIHtcclxuICAgIHZhciBmaWx0ZXJXcmFwcGVyID0gdGhpcy5hbGxGaWx0ZXJzW2NvbEtleV07XHJcbiAgICBpZiAoIWZpbHRlcldyYXBwZXIpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBpZiAoIWZpbHRlcldyYXBwZXIuZmlsdGVyLmlzRmlsdGVyQWN0aXZlKSB7IC8vIGJlY2F1c2UgdXNlcnMgY2FuIGRvIGN1c3RvbSBmaWx0ZXJzLCBnaXZlIG5pY2UgZXJyb3IgbWVzc2FnZVxyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZpbHRlciBpcyBtaXNzaW5nIG1ldGhvZCBpc0ZpbHRlckFjdGl2ZScpO1xyXG4gICAgfVxyXG4gICAgdmFyIGZpbHRlclByZXNlbnQgPSBmaWx0ZXJXcmFwcGVyLmZpbHRlci5pc0ZpbHRlckFjdGl2ZSgpO1xyXG4gICAgcmV0dXJuIGZpbHRlclByZXNlbnQ7XHJcbn07XHJcblxyXG5GaWx0ZXJNYW5hZ2VyLnByb3RvdHlwZS5kb2VzRmlsdGVyUGFzcyA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgIHZhciBkYXRhID0gbm9kZS5kYXRhO1xyXG4gICAgdmFyIGNvbEtleXMgPSBPYmplY3Qua2V5cyh0aGlzLmFsbEZpbHRlcnMpO1xyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjb2xLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykgeyAvLyBjcml0aWNhbCBjb2RlLCBkb24ndCB1c2UgZnVuY3Rpb25hbCBwcm9ncmFtbWluZ1xyXG5cclxuICAgICAgICB2YXIgY29sS2V5ID0gY29sS2V5c1tpXTtcclxuICAgICAgICB2YXIgZmlsdGVyV3JhcHBlciA9IHRoaXMuYWxsRmlsdGVyc1tjb2xLZXldO1xyXG5cclxuICAgICAgICAvLyBpZiBubyBmaWx0ZXIsIGFsd2F5cyBwYXNzXHJcbiAgICAgICAgaWYgKGZpbHRlcldyYXBwZXIgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciB2YWx1ZSA9IGRhdGFbZmlsdGVyV3JhcHBlci5maWVsZF07XHJcbiAgICAgICAgaWYgKCFmaWx0ZXJXcmFwcGVyLmZpbHRlci5kb2VzRmlsdGVyUGFzcykgeyAvLyBiZWNhdXNlIHVzZXJzIGNhbiBkbyBjdXN0b20gZmlsdGVycywgZ2l2ZSBuaWNlIGVycm9yIG1lc3NhZ2VcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmlsdGVyIGlzIG1pc3NpbmcgbWV0aG9kIGRvZXNGaWx0ZXJQYXNzJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBtb2RlbDtcclxuICAgICAgICAvLyBpZiBtb2RlbCBpcyBleHBvc2VkLCBncmFiIGl0XHJcbiAgICAgICAgaWYgKGZpbHRlcldyYXBwZXIuZmlsdGVyLmdldE1vZGVsKSB7XHJcbiAgICAgICAgICAgIG1vZGVsID0gZmlsdGVyV3JhcHBlci5maWx0ZXIuZ2V0TW9kZWwoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxyXG4gICAgICAgICAgICBtb2RlbDogbW9kZWwsXHJcbiAgICAgICAgICAgIG5vZGU6IG5vZGUsXHJcbiAgICAgICAgICAgIGRhdGE6IGRhdGFcclxuICAgICAgICB9O1xyXG4gICAgICAgIGlmICghZmlsdGVyV3JhcHBlci5maWx0ZXIuZG9lc0ZpbHRlclBhc3MocGFyYW1zKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gYWxsIGZpbHRlcnMgcGFzc2VkXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxufTtcclxuXHJcbkZpbHRlck1hbmFnZXIucHJvdG90eXBlLm9uTmV3Um93c0xvYWRlZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgT2JqZWN0LmtleXModGhpcy5hbGxGaWx0ZXJzKS5mb3JFYWNoKGZ1bmN0aW9uKGZpZWxkKSB7XHJcbiAgICAgICAgdmFyIGZpbHRlciA9IHRoYXQuYWxsRmlsdGVyc1tmaWVsZF0uZmlsdGVyO1xyXG4gICAgICAgIGlmIChmaWx0ZXIub25OZXdSb3dzTG9hZGVkKSB7XHJcbiAgICAgICAgICAgIGZpbHRlci5vbk5ld1Jvd3NMb2FkZWQoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufTtcclxuXHJcbkZpbHRlck1hbmFnZXIucHJvdG90eXBlLnBvc2l0aW9uUG9wdXAgPSBmdW5jdGlvbihldmVudFNvdXJjZSwgZVBvcHVwLCBlUG9wdXBSb290KSB7XHJcbiAgICB2YXIgc291cmNlUmVjdCA9IGV2ZW50U291cmNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgdmFyIHBhcmVudFJlY3QgPSBlUG9wdXBSb290LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cclxuICAgIHZhciB4ID0gc291cmNlUmVjdC5sZWZ0IC0gcGFyZW50UmVjdC5sZWZ0O1xyXG4gICAgdmFyIHkgPSBzb3VyY2VSZWN0LnRvcCAtIHBhcmVudFJlY3QudG9wICsgc291cmNlUmVjdC5oZWlnaHQ7XHJcblxyXG4gICAgLy8gaWYgcG9wdXAgaXMgb3ZlcmZsb3dpbmcgdG8gdGhlIHJpZ2h0LCBtb3ZlIGl0IGxlZnRcclxuICAgIHZhciB3aWR0aE9mUG9wdXAgPSAyMDA7IC8vIHRoaXMgaXMgc2V0IGluIHRoZSBjc3NcclxuICAgIHZhciB3aWR0aE9mUGFyZW50ID0gcGFyZW50UmVjdC5yaWdodCAtIHBhcmVudFJlY3QubGVmdDtcclxuICAgIHZhciBtYXhYID0gd2lkdGhPZlBhcmVudCAtIHdpZHRoT2ZQb3B1cCAtIDIwOyAvLyAyMCBwaXhlbHMgZ3JhY2VcclxuICAgIGlmICh4ID4gbWF4WCkgeyAvLyBtb3ZlIHBvc2l0aW9uIGxlZnQsIGJhY2sgaW50byB2aWV3XHJcbiAgICAgICAgeCA9IG1heFg7XHJcbiAgICB9XHJcbiAgICBpZiAoeCA8IDApIHsgLy8gaW4gY2FzZSB0aGUgcG9wdXAgaGFzIGEgbmVnYXRpdmUgdmFsdWVcclxuICAgICAgICB4ID0gMDtcclxuICAgIH1cclxuXHJcbiAgICBlUG9wdXAuc3R5bGUubGVmdCA9IHggKyBcInB4XCI7XHJcbiAgICBlUG9wdXAuc3R5bGUudG9wID0geSArIFwicHhcIjtcclxufTtcclxuXHJcbkZpbHRlck1hbmFnZXIucHJvdG90eXBlLnNob3dGaWx0ZXIgPSBmdW5jdGlvbihjb2xEZWZXcmFwcGVyLCBldmVudFNvdXJjZSkge1xyXG5cclxuICAgIHZhciBmaWx0ZXJXcmFwcGVyID0gdGhpcy5hbGxGaWx0ZXJzW2NvbERlZldyYXBwZXIuY29sS2V5XTtcclxuICAgIHZhciBjb2xEZWYgPSBjb2xEZWZXcmFwcGVyLmNvbERlZjtcclxuXHJcbiAgICBpZiAoIWZpbHRlcldyYXBwZXIpIHtcclxuICAgICAgICBmaWx0ZXJXcmFwcGVyID0ge1xyXG4gICAgICAgICAgICBjb2xLZXk6IGNvbERlZldyYXBwZXIuY29sS2V5LFxyXG4gICAgICAgICAgICBmaWVsZDogY29sRGVmLmZpZWxkXHJcbiAgICAgICAgfTtcclxuICAgICAgICB2YXIgZmlsdGVyQ2hhbmdlZENhbGxiYWNrID0gdGhpcy5ncmlkLm9uRmlsdGVyQ2hhbmdlZC5iaW5kKHRoaXMuZ3JpZCk7XHJcbiAgICAgICAgdmFyIGZpbHRlclBhcmFtcyA9IGNvbERlZi5maWx0ZXJQYXJhbXM7XHJcbiAgICAgICAgdmFyIHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgY29sRGVmOiBjb2xEZWYsXHJcbiAgICAgICAgICAgIHJvd01vZGVsOiB0aGlzLnJvd01vZGVsLFxyXG4gICAgICAgICAgICBmaWx0ZXJDaGFuZ2VkQ2FsbGJhY2s6IGZpbHRlckNoYW5nZWRDYWxsYmFjayxcclxuICAgICAgICAgICAgZmlsdGVyUGFyYW1zOiBmaWx0ZXJQYXJhbXMsXHJcbiAgICAgICAgICAgIHNjb3BlOiBmaWx0ZXJXcmFwcGVyLnNjb3BlXHJcbiAgICAgICAgfTtcclxuICAgICAgICBpZiAodHlwZW9mIGNvbERlZi5maWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgLy8gaWYgdXNlciBwcm92aWRlZCBhIGZpbHRlciwganVzdCB1c2UgaXRcclxuICAgICAgICAgICAgLy8gZmlyc3QgdXAsIGNyZWF0ZSBjaGlsZCBzY29wZSBpZiBuZWVkZWRcclxuICAgICAgICAgICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzQW5ndWxhckNvbXBpbGVGaWx0ZXJzKCkpIHtcclxuICAgICAgICAgICAgICAgIHZhciBzY29wZSA9IHRoaXMuJHNjb3BlLiRuZXcoKTtcclxuICAgICAgICAgICAgICAgIGZpbHRlcldyYXBwZXIuc2NvcGUgPSBzY29wZTtcclxuICAgICAgICAgICAgICAgIHBhcmFtcy4kc2NvcGUgPSBzY29wZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBub3cgY3JlYXRlIGZpbHRlclxyXG4gICAgICAgICAgICBmaWx0ZXJXcmFwcGVyLmZpbHRlciA9IG5ldyBjb2xEZWYuZmlsdGVyKHBhcmFtcyk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChjb2xEZWYuZmlsdGVyID09PSAndGV4dCcpIHtcclxuICAgICAgICAgICAgZmlsdGVyV3JhcHBlci5maWx0ZXIgPSBuZXcgU3RyaW5nRmlsdGVyKHBhcmFtcyk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChjb2xEZWYuZmlsdGVyID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICBmaWx0ZXJXcmFwcGVyLmZpbHRlciA9IG5ldyBOdW1iZXJGaWx0ZXIocGFyYW1zKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBmaWx0ZXJXcmFwcGVyLmZpbHRlciA9IG5ldyBTZXRGaWx0ZXIocGFyYW1zKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5hbGxGaWx0ZXJzW2NvbERlZldyYXBwZXIuY29sS2V5XSA9IGZpbHRlcldyYXBwZXI7XHJcblxyXG4gICAgICAgIGlmICghZmlsdGVyV3JhcHBlci5maWx0ZXIuZ2V0R3VpKSB7IC8vIGJlY2F1c2UgdXNlcnMgY2FuIGRvIGN1c3RvbSBmaWx0ZXJzLCBnaXZlIG5pY2UgZXJyb3IgbWVzc2FnZVxyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGaWx0ZXIgaXMgbWlzc2luZyBtZXRob2QgZ2V0R3VpJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgZUZpbHRlckd1aSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIGVGaWx0ZXJHdWkuY2xhc3NOYW1lID0gJ2FnLWZpbHRlcic7XHJcbiAgICAgICAgdmFyIGd1aUZyb21GaWx0ZXIgPSBmaWx0ZXJXcmFwcGVyLmZpbHRlci5nZXRHdWkoKTtcclxuICAgICAgICBpZiAodXRpbHMuaXNOb2RlT3JFbGVtZW50KGd1aUZyb21GaWx0ZXIpKSB7XHJcbiAgICAgICAgICAgIC8vYSBkb20gbm9kZSBvciBlbGVtZW50IHdhcyByZXR1cm5lZCwgc28gYWRkIGNoaWxkXHJcbiAgICAgICAgICAgIGVGaWx0ZXJHdWkuYXBwZW5kQ2hpbGQoZ3VpRnJvbUZpbHRlcik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy9vdGhlcndpc2UgYXNzdW1lIGl0IHdhcyBodG1sLCBzbyBqdXN0IGluc2VydFxyXG4gICAgICAgICAgICB2YXIgZVRleHRTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgICAgICAgICBlVGV4dFNwYW4uaW5uZXJIVE1MID0gZ3VpRnJvbUZpbHRlcjtcclxuICAgICAgICAgICAgZUZpbHRlckd1aS5hcHBlbmRDaGlsZChlVGV4dFNwYW4pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGZpbHRlcldyYXBwZXIuc2NvcGUpIHtcclxuICAgICAgICAgICAgZmlsdGVyV3JhcHBlci5ndWkgPSB0aGlzLiRjb21waWxlKGVGaWx0ZXJHdWkpKGZpbHRlcldyYXBwZXIuc2NvcGUpWzBdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGZpbHRlcldyYXBwZXIuZ3VpID0gZUZpbHRlckd1aTtcclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHZhciBlUG9wdXBQYXJlbnQgPSB0aGlzLmdyaWQuZ2V0UG9wdXBQYXJlbnQoKTtcclxuICAgIHRoaXMucG9zaXRpb25Qb3B1cChldmVudFNvdXJjZSwgZmlsdGVyV3JhcHBlci5ndWksIGVQb3B1cFBhcmVudCk7XHJcblxyXG4gICAgdXRpbHMuYWRkQXNNb2RhbFBvcHVwKGVQb3B1cFBhcmVudCwgZmlsdGVyV3JhcHBlci5ndWkpO1xyXG5cclxuICAgIGlmIChmaWx0ZXJXcmFwcGVyLmZpbHRlci5hZnRlckd1aUF0dGFjaGVkKSB7XHJcbiAgICAgICAgZmlsdGVyV3JhcHBlci5maWx0ZXIuYWZ0ZXJHdWlBdHRhY2hlZCgpO1xyXG4gICAgfVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBGaWx0ZXJNYW5hZ2VyO1xyXG4iLCJ2YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XHJcbnZhciB0ZW1wbGF0ZSA9IHJlcXVpcmUoJy4vbnVtYmVyRmlsdGVyVGVtcGxhdGUuanMnKTtcclxuXHJcbnZhciBFUVVBTFMgPSAxO1xyXG52YXIgTEVTU19USEFOID0gMjtcclxudmFyIEdSRUFURVJfVEhBTiA9IDM7XHJcblxyXG5mdW5jdGlvbiBOdW1iZXJGaWx0ZXIocGFyYW1zKSB7XHJcbiAgICB0aGlzLmZpbHRlckNoYW5nZWRDYWxsYmFjayA9IHBhcmFtcy5maWx0ZXJDaGFuZ2VkQ2FsbGJhY2s7XHJcbiAgICB0aGlzLmNyZWF0ZUd1aSgpO1xyXG4gICAgdGhpcy5maWx0ZXJOdW1iZXIgPSBudWxsO1xyXG4gICAgdGhpcy5maWx0ZXJUeXBlID0gRVFVQUxTO1xyXG59XHJcblxyXG4vKiBwdWJsaWMgKi9cclxuTnVtYmVyRmlsdGVyLnByb3RvdHlwZS5hZnRlckd1aUF0dGFjaGVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmVGaWx0ZXJUZXh0RmllbGQuZm9jdXMoKTtcclxufTtcclxuXHJcbi8qIHB1YmxpYyAqL1xyXG5OdW1iZXJGaWx0ZXIucHJvdG90eXBlLmRvZXNGaWx0ZXJQYXNzID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgaWYgKHRoaXMuZmlsdGVyTnVtYmVyID09PSBudWxsKSB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICB2YXIgdmFsdWUgPSBub2RlLnZhbHVlO1xyXG5cclxuICAgIGlmICghdmFsdWUgJiYgdmFsdWUgIT09IDApIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHZhbHVlQXNOdW1iZXI7XHJcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgIHZhbHVlQXNOdW1iZXIgPSB2YWx1ZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdmFsdWVBc051bWJlciA9IHBhcnNlRmxvYXQodmFsdWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAodGhpcy5maWx0ZXJUeXBlKSB7XHJcbiAgICAgICAgY2FzZSBFUVVBTFM6XHJcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZUFzTnVtYmVyID09PSB0aGlzLmZpbHRlck51bWJlcjtcclxuICAgICAgICBjYXNlIExFU1NfVEhBTjpcclxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlQXNOdW1iZXIgPD0gdGhpcy5maWx0ZXJOdW1iZXI7XHJcbiAgICAgICAgY2FzZSBHUkVBVEVSX1RIQU46XHJcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZUFzTnVtYmVyID49IHRoaXMuZmlsdGVyTnVtYmVyO1xyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIC8vIHNob3VsZCBuZXZlciBoYXBwZW5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ2ludmFsaWQgZmlsdGVyIHR5cGUgJyArIHRoaXMuZmlsdGVyVHlwZSk7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qIHB1YmxpYyAqL1xyXG5OdW1iZXJGaWx0ZXIucHJvdG90eXBlLmdldEd1aSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZUd1aTtcclxufTtcclxuXHJcbi8qIHB1YmxpYyAqL1xyXG5OdW1iZXJGaWx0ZXIucHJvdG90eXBlLmlzRmlsdGVyQWN0aXZlID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5maWx0ZXJOdW1iZXIgIT09IG51bGw7XHJcbn07XHJcblxyXG5OdW1iZXJGaWx0ZXIucHJvdG90eXBlLmNyZWF0ZUd1aSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5lR3VpID0gdXRpbHMubG9hZFRlbXBsYXRlKHRlbXBsYXRlKTtcclxuICAgIHRoaXMuZUZpbHRlclRleHRGaWVsZCA9IHRoaXMuZUd1aS5xdWVyeVNlbGVjdG9yKFwiI2ZpbHRlclRleHRcIik7XHJcbiAgICB0aGlzLmVUeXBlU2VsZWN0ID0gdGhpcy5lR3VpLnF1ZXJ5U2VsZWN0b3IoXCIjZmlsdGVyVHlwZVwiKTtcclxuXHJcbiAgICB1dGlscy5hZGRDaGFuZ2VMaXN0ZW5lcih0aGlzLmVGaWx0ZXJUZXh0RmllbGQsIHRoaXMub25GaWx0ZXJDaGFuZ2VkLmJpbmQodGhpcykpO1xyXG4gICAgdGhpcy5lVHlwZVNlbGVjdC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIHRoaXMub25UeXBlQ2hhbmdlZC5iaW5kKHRoaXMpKTtcclxufTtcclxuXHJcbk51bWJlckZpbHRlci5wcm90b3R5cGUub25UeXBlQ2hhbmdlZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5maWx0ZXJUeXBlID0gcGFyc2VJbnQodGhpcy5lVHlwZVNlbGVjdC52YWx1ZSk7XHJcbiAgICB0aGlzLmZpbHRlckNoYW5nZWRDYWxsYmFjaygpO1xyXG59O1xyXG5cclxuTnVtYmVyRmlsdGVyLnByb3RvdHlwZS5vbkZpbHRlckNoYW5nZWQgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBmaWx0ZXJUZXh0ID0gdXRpbHMubWFrZU51bGwodGhpcy5lRmlsdGVyVGV4dEZpZWxkLnZhbHVlKTtcclxuICAgIGlmIChmaWx0ZXJUZXh0ICYmIGZpbHRlclRleHQudHJpbSgpID09PSAnJykge1xyXG4gICAgICAgIGZpbHRlclRleHQgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgaWYgKGZpbHRlclRleHQpIHtcclxuICAgICAgICB0aGlzLmZpbHRlck51bWJlciA9IHBhcnNlRmxvYXQoZmlsdGVyVGV4dCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuZmlsdGVyTnVtYmVyID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMuZmlsdGVyQ2hhbmdlZENhbGxiYWNrKCk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE51bWJlckZpbHRlcjtcclxuIiwidmFyIHRlbXBsYXRlID0gW1xyXG4gICAgJzxkaXY+JyxcclxuICAgICc8ZGl2PicsXHJcbiAgICAnPHNlbGVjdCBjbGFzcz1cImFnLWZpbHRlci1zZWxlY3RcIiBpZD1cImZpbHRlclR5cGVcIj4nLFxyXG4gICAgJzxvcHRpb24gdmFsdWU9XCIxXCI+RXF1YWxzPC9vcHRpb24+JyxcclxuICAgICc8b3B0aW9uIHZhbHVlPVwiMlwiPkxlc3MgdGhhbjwvb3B0aW9uPicsXHJcbiAgICAnPG9wdGlvbiB2YWx1ZT1cIjNcIj5HcmVhdGVyIHRoYW48L29wdGlvbj4nLFxyXG4gICAgJzwvc2VsZWN0PicsXHJcbiAgICAnPC9kaXY+JyxcclxuICAgICc8ZGl2PicsXHJcbiAgICAnPGlucHV0IGNsYXNzPVwiYWctZmlsdGVyLWZpbHRlclwiIGlkPVwiZmlsdGVyVGV4dFwiIHR5cGU9XCJ0ZXh0XCIgcGxhY2Vob2xkZXI9XCJmaWx0ZXIuLi5cIi8+JyxcclxuICAgICc8L2Rpdj4nLFxyXG4gICAgJzwvZGl2PicsXHJcbl0uam9pbignJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlO1xyXG4iLCJ2YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XHJcbnZhciBTZXRGaWx0ZXJNb2RlbCA9IHJlcXVpcmUoJy4vc2V0RmlsdGVyTW9kZWwnKTtcclxudmFyIHRlbXBsYXRlID0gcmVxdWlyZSgnLi9zZXRGaWx0ZXJUZW1wbGF0ZScpO1xyXG5cclxudmFyIERFRkFVTFRfUk9XX0hFSUdIVCA9IDIwO1xyXG5cclxuZnVuY3Rpb24gU2V0RmlsdGVyKHBhcmFtcykge1xyXG4gICAgdmFyIGZpbHRlclBhcmFtcyA9IHBhcmFtcy5maWx0ZXJQYXJhbXM7XHJcbiAgICB0aGlzLnJvd0hlaWdodCA9IChmaWx0ZXJQYXJhbXMgJiYgZmlsdGVyUGFyYW1zLmNlbGxIZWlnaHQpID8gZmlsdGVyUGFyYW1zLmNlbGxIZWlnaHQgOiBERUZBVUxUX1JPV19IRUlHSFQ7XHJcbiAgICB0aGlzLm1vZGVsID0gbmV3IFNldEZpbHRlck1vZGVsKHBhcmFtcy5jb2xEZWYsIHBhcmFtcy5yb3dNb2RlbCk7XHJcbiAgICB0aGlzLmZpbHRlckNoYW5nZWRDYWxsYmFjayA9IHBhcmFtcy5maWx0ZXJDaGFuZ2VkQ2FsbGJhY2s7XHJcbiAgICB0aGlzLnJvd3NJbkJvZHlDb250YWluZXIgPSB7fTtcclxuICAgIHRoaXMuY29sRGVmID0gcGFyYW1zLmNvbERlZjtcclxuICAgIGlmIChmaWx0ZXJQYXJhbXMpIHtcclxuICAgICAgICB0aGlzLmNlbGxSZW5kZXJlciA9IGZpbHRlclBhcmFtcy5jZWxsUmVuZGVyZXI7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNyZWF0ZUd1aSgpO1xyXG4gICAgdGhpcy5hZGRTY3JvbGxMaXN0ZW5lcigpO1xyXG59XHJcblxyXG4vLyB3ZSBuZWVkIHRvIGhhdmUgdGhlIGd1aSBhdHRhY2hlZCBiZWZvcmUgd2UgY2FuIGRyYXcgdGhlIHZpcnR1YWwgcm93cywgYXMgdGhlXHJcbi8vIHZpcnR1YWwgcm93IGxvZ2ljIG5lZWRzIGluZm8gYWJvdXQgdGhlIGd1aSBzdGF0ZVxyXG4vKiBwdWJsaWMgKi9cclxuU2V0RmlsdGVyLnByb3RvdHlwZS5hZnRlckd1aUF0dGFjaGVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmRyYXdWaXJ0dWFsUm93cygpO1xyXG59O1xyXG5cclxuLyogcHVibGljICovXHJcblNldEZpbHRlci5wcm90b3R5cGUuaXNGaWx0ZXJBY3RpdmUgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLm1vZGVsLmlzRmlsdGVyQWN0aXZlKCk7XHJcbn07XHJcblxyXG4vKiBwdWJsaWMgKi9cclxuU2V0RmlsdGVyLnByb3RvdHlwZS5kb2VzRmlsdGVyUGFzcyA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgIHZhciB2YWx1ZSA9IG5vZGUudmFsdWU7XHJcbiAgICB2YXIgbW9kZWwgPSBub2RlLm1vZGVsO1xyXG4gICAgLy9pZiBubyBmaWx0ZXIsIGFsd2F5cyBwYXNzXHJcbiAgICBpZiAobW9kZWwuaXNFdmVyeXRoaW5nU2VsZWN0ZWQoKSkge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgLy9pZiBub3RoaW5nIHNlbGVjdGVkIGluIGZpbHRlciwgYWx3YXlzIGZhaWxcclxuICAgIGlmIChtb2RlbC5pc05vdGhpbmdTZWxlY3RlZCgpKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHZhbHVlID0gdXRpbHMubWFrZU51bGwodmFsdWUpO1xyXG4gICAgdmFyIGZpbHRlclBhc3NlZCA9IG1vZGVsLnNlbGVjdGVkVmFsdWVzTWFwW3ZhbHVlXSAhPT0gdW5kZWZpbmVkO1xyXG4gICAgcmV0dXJuIGZpbHRlclBhc3NlZDtcclxufTtcclxuXHJcbi8qIHB1YmxpYyAqL1xyXG5TZXRGaWx0ZXIucHJvdG90eXBlLmdldEd1aSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZUd1aTtcclxufTtcclxuXHJcbi8qIHB1YmxpYyAqL1xyXG5TZXRGaWx0ZXIucHJvdG90eXBlLm9uTmV3Um93c0xvYWRlZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5tb2RlbC5zZWxlY3RFdmVyeXRoaW5nKCk7XHJcbiAgICB0aGlzLnVwZGF0ZUFsbENoZWNrYm94ZXModHJ1ZSk7XHJcbn07XHJcblxyXG4vKiBwdWJsaWMgKi9cclxuU2V0RmlsdGVyLnByb3RvdHlwZS5nZXRNb2RlbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMubW9kZWw7XHJcbn07XHJcblxyXG5TZXRGaWx0ZXIucHJvdG90eXBlLmNyZWF0ZUd1aSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLmVHdWkgPSB1dGlscy5sb2FkVGVtcGxhdGUodGVtcGxhdGUpO1xyXG5cclxuICAgIHRoaXMuZUxpc3RDb250YWluZXIgPSB0aGlzLmVHdWkucXVlcnlTZWxlY3RvcihcIi5hZy1maWx0ZXItbGlzdC1jb250YWluZXJcIik7XHJcbiAgICB0aGlzLmVGaWx0ZXJWYWx1ZVRlbXBsYXRlID0gdGhpcy5lR3VpLnF1ZXJ5U2VsZWN0b3IoXCIjaXRlbUZvclJlcGVhdFwiKTtcclxuICAgIHRoaXMuZVNlbGVjdEFsbCA9IHRoaXMuZUd1aS5xdWVyeVNlbGVjdG9yKFwiI3NlbGVjdEFsbFwiKTtcclxuICAgIHRoaXMuZUxpc3RWaWV3cG9ydCA9IHRoaXMuZUd1aS5xdWVyeVNlbGVjdG9yKFwiLmFnLWZpbHRlci1saXN0LXZpZXdwb3J0XCIpO1xyXG4gICAgdGhpcy5lTWluaUZpbHRlciA9IHRoaXMuZUd1aS5xdWVyeVNlbGVjdG9yKFwiLmFnLWZpbHRlci1maWx0ZXJcIik7XHJcbiAgICB0aGlzLmVMaXN0Q29udGFpbmVyLnN0eWxlLmhlaWdodCA9ICh0aGlzLm1vZGVsLmdldFVuaXF1ZVZhbHVlQ291bnQoKSAqIHRoaXMucm93SGVpZ2h0KSArIFwicHhcIjtcclxuXHJcbiAgICB0aGlzLnNldENvbnRhaW5lckhlaWdodCgpO1xyXG4gICAgdGhpcy5lTWluaUZpbHRlci52YWx1ZSA9IHRoaXMubW9kZWwuZ2V0TWluaUZpbHRlcigpO1xyXG4gICAgdXRpbHMuYWRkQ2hhbmdlTGlzdGVuZXIodGhpcy5lTWluaUZpbHRlciwgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgX3RoaXMub25GaWx0ZXJDaGFuZ2VkKCk7XHJcbiAgICB9KTtcclxuICAgIHV0aWxzLnJlbW92ZUFsbENoaWxkcmVuKHRoaXMuZUxpc3RDb250YWluZXIpO1xyXG5cclxuICAgIHRoaXMuZVNlbGVjdEFsbC5vbmNsaWNrID0gdGhpcy5vblNlbGVjdEFsbC5iaW5kKHRoaXMpO1xyXG5cclxuICAgIGlmICh0aGlzLm1vZGVsLmlzRXZlcnl0aGluZ1NlbGVjdGVkKCkpIHtcclxuICAgICAgICB0aGlzLmVTZWxlY3RBbGwuaW5kZXRlcm1pbmF0ZSA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuZVNlbGVjdEFsbC5jaGVja2VkID0gdHJ1ZTtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5tb2RlbC5pc05vdGhpbmdTZWxlY3RlZCgpKSB7XHJcbiAgICAgICAgdGhpcy5lU2VsZWN0QWxsLmluZGV0ZXJtaW5hdGUgPSBmYWxzZTtcclxuICAgICAgICB0aGlzLmVTZWxlY3RBbGwuY2hlY2tlZCA9IGZhbHNlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmVTZWxlY3RBbGwuaW5kZXRlcm1pbmF0ZSA9IHRydWU7XHJcbiAgICB9XHJcbn07XHJcblxyXG5TZXRGaWx0ZXIucHJvdG90eXBlLnNldENvbnRhaW5lckhlaWdodCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5lTGlzdENvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSAodGhpcy5tb2RlbC5nZXREaXNwbGF5ZWRWYWx1ZUNvdW50KCkgKiB0aGlzLnJvd0hlaWdodCkgKyBcInB4XCI7XHJcbn07XHJcblxyXG5TZXRGaWx0ZXIucHJvdG90eXBlLmRyYXdWaXJ0dWFsUm93cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRvcFBpeGVsID0gdGhpcy5lTGlzdFZpZXdwb3J0LnNjcm9sbFRvcDtcclxuICAgIHZhciBib3R0b21QaXhlbCA9IHRvcFBpeGVsICsgdGhpcy5lTGlzdFZpZXdwb3J0Lm9mZnNldEhlaWdodDtcclxuXHJcbiAgICB2YXIgZmlyc3RSb3cgPSBNYXRoLmZsb29yKHRvcFBpeGVsIC8gdGhpcy5yb3dIZWlnaHQpO1xyXG4gICAgdmFyIGxhc3RSb3cgPSBNYXRoLmZsb29yKGJvdHRvbVBpeGVsIC8gdGhpcy5yb3dIZWlnaHQpO1xyXG5cclxuICAgIHRoaXMuZW5zdXJlUm93c1JlbmRlcmVkKGZpcnN0Um93LCBsYXN0Um93KTtcclxufTtcclxuXHJcblNldEZpbHRlci5wcm90b3R5cGUuZW5zdXJlUm93c1JlbmRlcmVkID0gZnVuY3Rpb24oc3RhcnQsIGZpbmlzaCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICAvL2F0IHRoZSBlbmQsIHRoaXMgYXJyYXkgd2lsbCBjb250YWluIHRoZSBpdGVtcyB3ZSBuZWVkIHRvIHJlbW92ZVxyXG4gICAgdmFyIHJvd3NUb1JlbW92ZSA9IE9iamVjdC5rZXlzKHRoaXMucm93c0luQm9keUNvbnRhaW5lcik7XHJcblxyXG4gICAgLy9hZGQgaW4gbmV3IHJvd3NcclxuICAgIGZvciAodmFyIHJvd0luZGV4ID0gc3RhcnQ7IHJvd0luZGV4IDw9IGZpbmlzaDsgcm93SW5kZXgrKykge1xyXG4gICAgICAgIC8vc2VlIGlmIGl0ZW0gYWxyZWFkeSB0aGVyZSwgYW5kIGlmIHllcywgdGFrZSBpdCBvdXQgb2YgdGhlICd0byByZW1vdmUnIGFycmF5XHJcbiAgICAgICAgaWYgKHJvd3NUb1JlbW92ZS5pbmRleE9mKHJvd0luZGV4LnRvU3RyaW5nKCkpID49IDApIHtcclxuICAgICAgICAgICAgcm93c1RvUmVtb3ZlLnNwbGljZShyb3dzVG9SZW1vdmUuaW5kZXhPZihyb3dJbmRleC50b1N0cmluZygpKSwgMSk7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvL2NoZWNrIHRoaXMgcm93IGFjdHVhbGx5IGV4aXN0cyAoaW4gY2FzZSBvdmVyZmxvdyBidWZmZXIgd2luZG93IGV4Y2VlZHMgcmVhbCBkYXRhKVxyXG4gICAgICAgIGlmICh0aGlzLm1vZGVsLmdldERpc3BsYXllZFZhbHVlQ291bnQoKSA+IHJvd0luZGV4KSB7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMubW9kZWwuZ2V0RGlzcGxheWVkVmFsdWUocm93SW5kZXgpO1xyXG4gICAgICAgICAgICBfdGhpcy5pbnNlcnRSb3codmFsdWUsIHJvd0luZGV4KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy9hdCB0aGlzIHBvaW50LCBldmVyeXRoaW5nIGluIG91ciAncm93c1RvUmVtb3ZlJyAuIC4gLlxyXG4gICAgdGhpcy5yZW1vdmVWaXJ0dWFsUm93cyhyb3dzVG9SZW1vdmUpO1xyXG59O1xyXG5cclxuLy90YWtlcyBhcnJheSBvZiByb3cgaWQnc1xyXG5TZXRGaWx0ZXIucHJvdG90eXBlLnJlbW92ZVZpcnR1YWxSb3dzID0gZnVuY3Rpb24ocm93c1RvUmVtb3ZlKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgcm93c1RvUmVtb3ZlLmZvckVhY2goZnVuY3Rpb24oaW5kZXhUb1JlbW92ZSkge1xyXG4gICAgICAgIHZhciBlUm93VG9SZW1vdmUgPSBfdGhpcy5yb3dzSW5Cb2R5Q29udGFpbmVyW2luZGV4VG9SZW1vdmVdO1xyXG4gICAgICAgIF90aGlzLmVMaXN0Q29udGFpbmVyLnJlbW92ZUNoaWxkKGVSb3dUb1JlbW92ZSk7XHJcbiAgICAgICAgZGVsZXRlIF90aGlzLnJvd3NJbkJvZHlDb250YWluZXJbaW5kZXhUb1JlbW92ZV07XHJcbiAgICB9KTtcclxufTtcclxuXHJcblNldEZpbHRlci5wcm90b3R5cGUuaW5zZXJ0Um93ID0gZnVuY3Rpb24odmFsdWUsIHJvd0luZGV4KSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHZhciBlRmlsdGVyVmFsdWUgPSB0aGlzLmVGaWx0ZXJWYWx1ZVRlbXBsYXRlLmNsb25lTm9kZSh0cnVlKTtcclxuXHJcbiAgICB2YXIgdmFsdWVFbGVtZW50ID0gZUZpbHRlclZhbHVlLnF1ZXJ5U2VsZWN0b3IoXCIuYWctZmlsdGVyLXZhbHVlXCIpO1xyXG4gICAgaWYgKHRoaXMuY2VsbFJlbmRlcmVyKSB7XHJcbiAgICAgICAgLy9yZW5kZXJlciBwcm92aWRlZCwgc28gdXNlIGl0XHJcbiAgICAgICAgdmFyIHJlc3VsdEZyb21SZW5kZXJlciA9IHRoaXMuY2VsbFJlbmRlcmVyKHtcclxuICAgICAgICAgICAgdmFsdWU6IHZhbHVlXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICh1dGlscy5pc05vZGUocmVzdWx0RnJvbVJlbmRlcmVyKSkge1xyXG4gICAgICAgICAgICAvL2EgZG9tIG5vZGUgb3IgZWxlbWVudCB3YXMgcmV0dXJuZWQsIHNvIGFkZCBjaGlsZFxyXG4gICAgICAgICAgICB2YWx1ZUVsZW1lbnQuYXBwZW5kQ2hpbGQocmVzdWx0RnJvbVJlbmRlcmVyKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvL290aGVyd2lzZSBhc3N1bWUgaXQgd2FzIGh0bWwsIHNvIGp1c3QgaW5zZXJ0XHJcbiAgICAgICAgICAgIHZhbHVlRWxlbWVudC5pbm5lckhUTUwgPSByZXN1bHRGcm9tUmVuZGVyZXI7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy9vdGhlcndpc2UgZGlzcGxheSBhcyBhIHN0cmluZ1xyXG4gICAgICAgIHZhciBkaXNwbGF5TmFtZU9mVmFsdWUgPSB2YWx1ZSA9PT0gbnVsbCA/IFwiKEJsYW5rcylcIiA6IHZhbHVlO1xyXG4gICAgICAgIHZhbHVlRWxlbWVudC5pbm5lckhUTUwgPSBkaXNwbGF5TmFtZU9mVmFsdWU7XHJcbiAgICB9XHJcbiAgICB2YXIgZUNoZWNrYm94ID0gZUZpbHRlclZhbHVlLnF1ZXJ5U2VsZWN0b3IoXCJpbnB1dFwiKTtcclxuICAgIGVDaGVja2JveC5jaGVja2VkID0gdGhpcy5tb2RlbC5pc1ZhbHVlU2VsZWN0ZWQodmFsdWUpO1xyXG5cclxuICAgIGVDaGVja2JveC5vbmNsaWNrID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgX3RoaXMub25DaGVja2JveENsaWNrZWQoZUNoZWNrYm94LCB2YWx1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZUZpbHRlclZhbHVlLnN0eWxlLnRvcCA9ICh0aGlzLnJvd0hlaWdodCAqIHJvd0luZGV4KSArIFwicHhcIjtcclxuXHJcbiAgICB0aGlzLmVMaXN0Q29udGFpbmVyLmFwcGVuZENoaWxkKGVGaWx0ZXJWYWx1ZSk7XHJcbiAgICB0aGlzLnJvd3NJbkJvZHlDb250YWluZXJbcm93SW5kZXhdID0gZUZpbHRlclZhbHVlO1xyXG59O1xyXG5cclxuU2V0RmlsdGVyLnByb3RvdHlwZS5vbkNoZWNrYm94Q2xpY2tlZCA9IGZ1bmN0aW9uKGVDaGVja2JveCwgdmFsdWUpIHtcclxuICAgIHZhciBjaGVja2VkID0gZUNoZWNrYm94LmNoZWNrZWQ7XHJcbiAgICBpZiAoY2hlY2tlZCkge1xyXG4gICAgICAgIHRoaXMubW9kZWwuc2VsZWN0VmFsdWUodmFsdWUpO1xyXG4gICAgICAgIGlmICh0aGlzLm1vZGVsLmlzRXZlcnl0aGluZ1NlbGVjdGVkKCkpIHtcclxuICAgICAgICAgICAgdGhpcy5lU2VsZWN0QWxsLmluZGV0ZXJtaW5hdGUgPSBmYWxzZTtcclxuICAgICAgICAgICAgdGhpcy5lU2VsZWN0QWxsLmNoZWNrZWQgPSB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZVNlbGVjdEFsbC5pbmRldGVybWluYXRlID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMubW9kZWwudW5zZWxlY3RWYWx1ZSh2YWx1ZSk7XHJcbiAgICAgICAgLy9pZiBzZXQgaXMgZW1wdHksIG5vdGhpbmcgaXMgc2VsZWN0ZWRcclxuICAgICAgICBpZiAodGhpcy5tb2RlbC5pc05vdGhpbmdTZWxlY3RlZCgpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZVNlbGVjdEFsbC5pbmRldGVybWluYXRlID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHRoaXMuZVNlbGVjdEFsbC5jaGVja2VkID0gZmFsc2U7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5lU2VsZWN0QWxsLmluZGV0ZXJtaW5hdGUgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmZpbHRlckNoYW5nZWRDYWxsYmFjaygpO1xyXG59O1xyXG5cclxuU2V0RmlsdGVyLnByb3RvdHlwZS5vbkZpbHRlckNoYW5nZWQgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBtaW5pRmlsdGVyQ2hhbmdlZCA9IHRoaXMubW9kZWwuc2V0TWluaUZpbHRlcih0aGlzLmVNaW5pRmlsdGVyLnZhbHVlKTtcclxuICAgIGlmIChtaW5pRmlsdGVyQ2hhbmdlZCkge1xyXG4gICAgICAgIHRoaXMuc2V0Q29udGFpbmVySGVpZ2h0KCk7XHJcbiAgICAgICAgdGhpcy5jbGVhclZpcnR1YWxSb3dzKCk7XHJcbiAgICAgICAgdGhpcy5kcmF3VmlydHVhbFJvd3MoKTtcclxuICAgIH1cclxufTtcclxuXHJcblNldEZpbHRlci5wcm90b3R5cGUuY2xlYXJWaXJ0dWFsUm93cyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHJvd3NUb1JlbW92ZSA9IE9iamVjdC5rZXlzKHRoaXMucm93c0luQm9keUNvbnRhaW5lcik7XHJcbiAgICB0aGlzLnJlbW92ZVZpcnR1YWxSb3dzKHJvd3NUb1JlbW92ZSk7XHJcbn07XHJcblxyXG5TZXRGaWx0ZXIucHJvdG90eXBlLm9uU2VsZWN0QWxsID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgY2hlY2tlZCA9IHRoaXMuZVNlbGVjdEFsbC5jaGVja2VkO1xyXG4gICAgaWYgKGNoZWNrZWQpIHtcclxuICAgICAgICB0aGlzLm1vZGVsLnNlbGVjdEV2ZXJ5dGhpbmcoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5tb2RlbC5zZWxlY3ROb3RoaW5nKCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnVwZGF0ZUFsbENoZWNrYm94ZXMoY2hlY2tlZCk7XHJcbiAgICB0aGlzLmZpbHRlckNoYW5nZWRDYWxsYmFjaygpO1xyXG59O1xyXG5cclxuU2V0RmlsdGVyLnByb3RvdHlwZS51cGRhdGVBbGxDaGVja2JveGVzID0gZnVuY3Rpb24oY2hlY2tlZCkge1xyXG4gICAgdmFyIGN1cnJlbnRseURpc3BsYXllZENoZWNrYm94ZXMgPSB0aGlzLmVMaXN0Q29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoXCJbZmlsdGVyLWNoZWNrYm94PXRydWVdXCIpO1xyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjdXJyZW50bHlEaXNwbGF5ZWRDaGVja2JveGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGN1cnJlbnRseURpc3BsYXllZENoZWNrYm94ZXNbaV0uY2hlY2tlZCA9IGNoZWNrZWQ7XHJcbiAgICB9XHJcbn07XHJcblxyXG5TZXRGaWx0ZXIucHJvdG90eXBlLmFkZFNjcm9sbExpc3RlbmVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuZUxpc3RWaWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIF90aGlzLmRyYXdWaXJ0dWFsUm93cygpO1xyXG4gICAgfSk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNldEZpbHRlcjtcclxuIiwiICAgIHZhciB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzJyk7XHJcblxyXG4gICAgZnVuY3Rpb24gU2V0RmlsdGVyTW9kZWwoY29sRGVmLCByb3dNb2RlbCkge1xyXG5cclxuICAgICAgICBpZiAoY29sRGVmLmZpbHRlclBhcmFtcyAmJiBjb2xEZWYuZmlsdGVyUGFyYW1zLnZhbHVlcykge1xyXG4gICAgICAgICAgICB0aGlzLnVuaXF1ZVZhbHVlcyA9IGNvbERlZi5maWx0ZXJQYXJhbXMudmFsdWVzO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlVW5pcXVlVmFsdWVzKHJvd01vZGVsLCBjb2xEZWYuZmllbGQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNvbERlZi5jb21wYXJhdG9yKSB7XHJcbiAgICAgICAgICAgIHRoaXMudW5pcXVlVmFsdWVzLnNvcnQoY29sRGVmLmNvbXBhcmF0b3IpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMudW5pcXVlVmFsdWVzLnNvcnQodXRpbHMuZGVmYXVsdENvbXBhcmF0b3IpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5kaXNwbGF5ZWRWYWx1ZXMgPSB0aGlzLnVuaXF1ZVZhbHVlcztcclxuICAgICAgICB0aGlzLm1pbmlGaWx0ZXIgPSBudWxsO1xyXG4gICAgICAgIC8vd2UgdXNlIGEgbWFwIHJhdGhlciB0aGFuIGFuIGFycmF5IGZvciB0aGUgc2VsZWN0ZWQgdmFsdWVzIGFzIHRoZSBsb29rdXBcclxuICAgICAgICAvL2ZvciBhIG1hcCBpcyBtdWNoIGZhc3RlciB0aGFuIHRoZSBsb29rdXAgZm9yIGFuIGFycmF5LCBlc3BlY2lhbGx5IHdoZW5cclxuICAgICAgICAvL3RoZSBsZW5ndGggb2YgdGhlIGFycmF5IGlzIHRob3VzYW5kcyBvZiByZWNvcmRzIGxvbmdcclxuICAgICAgICB0aGlzLnNlbGVjdGVkVmFsdWVzTWFwID0ge307XHJcbiAgICAgICAgdGhpcy5zZWxlY3RFdmVyeXRoaW5nKCk7XHJcbiAgICB9XHJcblxyXG4gICAgU2V0RmlsdGVyTW9kZWwucHJvdG90eXBlLmNyZWF0ZVVuaXF1ZVZhbHVlcyA9IGZ1bmN0aW9uKHJvd01vZGVsLCBrZXkpIHtcclxuICAgICAgICB2YXIgdW5pcXVlQ2hlY2sgPSB7fTtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gW107XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIHJlY3Vyc2l2ZWx5UHJvY2Vzcyhub2Rlcykge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbm9kZSA9IG5vZGVzW2ldO1xyXG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuZ3JvdXAgJiYgIW5vZGUuZm9vdGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gZ3JvdXAgbm9kZSwgc28gZGlnIGRlZXBlclxyXG4gICAgICAgICAgICAgICAgICAgIHJlY3Vyc2l2ZWx5UHJvY2Vzcyhub2RlLmNoaWxkcmVuKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBub2RlLmRhdGE7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gZGF0YSA/IGRhdGFba2V5XSA6IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSBcIlwiIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXVuaXF1ZUNoZWNrLmhhc093blByb3BlcnR5KHZhbHVlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuaXF1ZUNoZWNrW3ZhbHVlXSA9IDE7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgdG9wTGV2ZWxOb2RlcyA9IHJvd01vZGVsLmdldFRvcExldmVsTm9kZXMoKTtcclxuICAgICAgICByZWN1cnNpdmVseVByb2Nlc3ModG9wTGV2ZWxOb2Rlcyk7XHJcblxyXG4gICAgICAgIHRoaXMudW5pcXVlVmFsdWVzID0gcmVzdWx0O1xyXG4gICAgfTtcclxuXHJcbiAgICAvL3NldHMgbWluaSBmaWx0ZXIuIHJldHVybnMgdHJ1ZSBpZiBpdCBjaGFuZ2VkIGZyb20gbGFzdCB2YWx1ZSwgb3RoZXJ3aXNlIGZhbHNlXHJcbiAgICBTZXRGaWx0ZXJNb2RlbC5wcm90b3R5cGUuc2V0TWluaUZpbHRlciA9IGZ1bmN0aW9uKG5ld01pbmlGaWx0ZXIpIHtcclxuICAgICAgICBuZXdNaW5pRmlsdGVyID0gdXRpbHMubWFrZU51bGwobmV3TWluaUZpbHRlcik7XHJcbiAgICAgICAgaWYgKHRoaXMubWluaUZpbHRlciA9PT0gbmV3TWluaUZpbHRlcikge1xyXG4gICAgICAgICAgICAvL2RvIG5vdGhpbmcgaWYgZmlsdGVyIGhhcyBub3QgY2hhbmdlZFxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMubWluaUZpbHRlciA9IG5ld01pbmlGaWx0ZXI7XHJcbiAgICAgICAgdGhpcy5maWx0ZXJEaXNwbGF5ZWRWYWx1ZXMoKTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH07XHJcblxyXG4gICAgU2V0RmlsdGVyTW9kZWwucHJvdG90eXBlLmdldE1pbmlGaWx0ZXIgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5taW5pRmlsdGVyO1xyXG4gICAgfTtcclxuXHJcbiAgICBTZXRGaWx0ZXJNb2RlbC5wcm90b3R5cGUuZmlsdGVyRGlzcGxheWVkVmFsdWVzID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgLy8gaWYgbm8gZmlsdGVyLCBqdXN0IHVzZSB0aGUgdW5pcXVlIHZhbHVlc1xyXG4gICAgICAgIGlmICh0aGlzLm1pbmlGaWx0ZXIgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5kaXNwbGF5ZWRWYWx1ZXMgPSB0aGlzLnVuaXF1ZVZhbHVlcztcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gaWYgZmlsdGVyIHByZXNlbnQsIHdlIGZpbHRlciBkb3duIHRoZSBsaXN0XHJcbiAgICAgICAgdGhpcy5kaXNwbGF5ZWRWYWx1ZXMgPSBbXTtcclxuICAgICAgICB2YXIgbWluaUZpbHRlclVwcGVyQ2FzZSA9IHRoaXMubWluaUZpbHRlci50b1VwcGVyQ2FzZSgpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy51bmlxdWVWYWx1ZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciB1bmlxdWVWYWx1ZSA9IHRoaXMudW5pcXVlVmFsdWVzW2ldO1xyXG4gICAgICAgICAgICBpZiAodW5pcXVlVmFsdWUgIT09IG51bGwgJiYgdW5pcXVlVmFsdWUudG9TdHJpbmcoKS50b1VwcGVyQ2FzZSgpLmluZGV4T2YobWluaUZpbHRlclVwcGVyQ2FzZSkgPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5ZWRWYWx1ZXMucHVzaCh1bmlxdWVWYWx1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgfTtcclxuXHJcbiAgICBTZXRGaWx0ZXJNb2RlbC5wcm90b3R5cGUuZ2V0RGlzcGxheWVkVmFsdWVDb3VudCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmRpc3BsYXllZFZhbHVlcy5sZW5ndGg7XHJcbiAgICB9O1xyXG5cclxuICAgIFNldEZpbHRlck1vZGVsLnByb3RvdHlwZS5nZXREaXNwbGF5ZWRWYWx1ZSA9IGZ1bmN0aW9uKGluZGV4KSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZGlzcGxheWVkVmFsdWVzW2luZGV4XTtcclxuICAgIH07XHJcblxyXG4gICAgU2V0RmlsdGVyTW9kZWwucHJvdG90eXBlLnNlbGVjdEV2ZXJ5dGhpbmcgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgY291bnQgPSB0aGlzLnVuaXF1ZVZhbHVlcy5sZW5ndGg7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHRoaXMudW5pcXVlVmFsdWVzW2ldO1xyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkVmFsdWVzTWFwW3ZhbHVlXSA9IG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuc2VsZWN0ZWRWYWx1ZXNDb3VudCA9IGNvdW50O1xyXG4gICAgfTtcclxuXHJcbiAgICBTZXRGaWx0ZXJNb2RlbC5wcm90b3R5cGUuaXNGaWx0ZXJBY3RpdmUgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy51bmlxdWVWYWx1ZXMubGVuZ3RoICE9PSB0aGlzLnNlbGVjdGVkVmFsdWVzQ291bnQ7XHJcbiAgICB9O1xyXG5cclxuICAgIFNldEZpbHRlck1vZGVsLnByb3RvdHlwZS5zZWxlY3ROb3RoaW5nID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5zZWxlY3RlZFZhbHVlc01hcCA9IHt9O1xyXG4gICAgICAgIHRoaXMuc2VsZWN0ZWRWYWx1ZXNDb3VudCA9IDA7XHJcbiAgICB9O1xyXG5cclxuICAgIFNldEZpbHRlck1vZGVsLnByb3RvdHlwZS5nZXRVbmlxdWVWYWx1ZUNvdW50ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pcXVlVmFsdWVzLmxlbmd0aDtcclxuICAgIH07XHJcblxyXG4gICAgU2V0RmlsdGVyTW9kZWwucHJvdG90eXBlLnVuc2VsZWN0VmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgIGlmICh0aGlzLnNlbGVjdGVkVmFsdWVzTWFwW3ZhbHVlXSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnNlbGVjdGVkVmFsdWVzTWFwW3ZhbHVlXTtcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZFZhbHVlc0NvdW50LS07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBTZXRGaWx0ZXJNb2RlbC5wcm90b3R5cGUuc2VsZWN0VmFsdWUgPSBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgIGlmICh0aGlzLnNlbGVjdGVkVmFsdWVzTWFwW3ZhbHVlXSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWRWYWx1ZXNNYXBbdmFsdWVdID0gbnVsbDtcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZFZhbHVlc0NvdW50Kys7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBTZXRGaWx0ZXJNb2RlbC5wcm90b3R5cGUuaXNWYWx1ZVNlbGVjdGVkID0gZnVuY3Rpb24odmFsdWUpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZWxlY3RlZFZhbHVlc01hcFt2YWx1ZV0gIT09IHVuZGVmaW5lZDtcclxuICAgIH07XHJcblxyXG4gICAgU2V0RmlsdGVyTW9kZWwucHJvdG90eXBlLmlzRXZlcnl0aGluZ1NlbGVjdGVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pcXVlVmFsdWVzLmxlbmd0aCA9PT0gdGhpcy5zZWxlY3RlZFZhbHVlc0NvdW50O1xyXG4gICAgfTtcclxuXHJcbiAgICBTZXRGaWx0ZXJNb2RlbC5wcm90b3R5cGUuaXNOb3RoaW5nU2VsZWN0ZWQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy51bmlxdWVWYWx1ZXMubGVuZ3RoID09PSAwO1xyXG4gICAgfTtcclxuXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFNldEZpbHRlck1vZGVsO1xyXG4iLCJ2YXIgdGVtcGxhdGUgPSBbXHJcbiAgICAnPGRpdj4nLFxyXG4gICAgJyAgICA8ZGl2IGNsYXNzPVwiYWctZmlsdGVyLWhlYWRlci1jb250YWluZXJcIj4nLFxyXG4gICAgJyAgICAgICAgPGlucHV0IGNsYXNzPVwiYWctZmlsdGVyLWZpbHRlclwiIHR5cGU9XCJ0ZXh0XCIgcGxhY2Vob2xkZXI9XCJzZWFyY2guLi5cIi8+JyxcclxuICAgICcgICAgPC9kaXY+JyxcclxuICAgICcgICAgPGRpdiBjbGFzcz1cImFnLWZpbHRlci1oZWFkZXItY29udGFpbmVyXCI+JyxcclxuICAgICcgICAgICAgIDxsYWJlbD4nLFxyXG4gICAgJyAgICAgICAgICAgIDxpbnB1dCBpZD1cInNlbGVjdEFsbFwiIHR5cGU9XCJjaGVja2JveFwiIGNsYXNzPVwiYWctZmlsdGVyLWNoZWNrYm94XCIvPicsXHJcbiAgICAnICAgICAgICAgICAgKFNlbGVjdCBBbGwpJyxcclxuICAgICcgICAgICAgIDwvbGFiZWw+JyxcclxuICAgICcgICAgPC9kaXY+JyxcclxuICAgICcgICAgPGRpdiBjbGFzcz1cImFnLWZpbHRlci1saXN0LXZpZXdwb3J0XCI+JyxcclxuICAgICcgICAgICAgIDxkaXYgY2xhc3M9XCJhZy1maWx0ZXItbGlzdC1jb250YWluZXJcIj4nLFxyXG4gICAgJyAgICAgICAgICAgIDxkaXYgaWQ9XCJpdGVtRm9yUmVwZWF0XCIgY2xhc3M9XCJhZy1maWx0ZXItaXRlbVwiPicsXHJcbiAgICAnICAgICAgICAgICAgICAgIDxsYWJlbD4nLFxyXG4gICAgJyAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGNsYXNzPVwiYWctZmlsdGVyLWNoZWNrYm94XCIgZmlsdGVyLWNoZWNrYm94PVwidHJ1ZVwiLz4nLFxyXG4gICAgJyAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJhZy1maWx0ZXItdmFsdWVcIj48L3NwYW4+JyxcclxuICAgICcgICAgICAgICAgICAgICAgPC9sYWJlbD4nLFxyXG4gICAgJyAgICAgICAgICAgIDwvZGl2PicsXHJcbiAgICAnICAgICAgICA8L2Rpdj4nLFxyXG4gICAgJyAgICA8L2Rpdj4nLFxyXG4gICAgJzwvZGl2PicsXHJcbl0uam9pbignJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlO1xyXG4iLCJ2YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xyXG52YXIgdGVtcGxhdGUgPSByZXF1aXJlKCcuL3RleHRGaWx0ZXJUZW1wbGF0ZScpO1xyXG5cclxudmFyIENPTlRBSU5TID0gMTtcclxudmFyIEVRVUFMUyA9IDI7XHJcbnZhciBTVEFSVFNfV0lUSCA9IDM7XHJcbnZhciBFTkRTX1dJVEggPSA0O1xyXG5cclxuZnVuY3Rpb24gVGV4dEZpbHRlcihwYXJhbXMpIHtcclxuICAgIHRoaXMuZmlsdGVyQ2hhbmdlZENhbGxiYWNrID0gcGFyYW1zLmZpbHRlckNoYW5nZWRDYWxsYmFjaztcclxuICAgIHRoaXMuY3JlYXRlR3VpKCk7XHJcbiAgICB0aGlzLmZpbHRlclRleHQgPSBudWxsO1xyXG4gICAgdGhpcy5maWx0ZXJUeXBlID0gQ09OVEFJTlM7XHJcbn1cclxuXHJcbi8qIHB1YmxpYyAqL1xyXG5UZXh0RmlsdGVyLnByb3RvdHlwZS5hZnRlckd1aUF0dGFjaGVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmVGaWx0ZXJUZXh0RmllbGQuZm9jdXMoKTtcclxufTtcclxuXHJcbi8qIHB1YmxpYyAqL1xyXG5UZXh0RmlsdGVyLnByb3RvdHlwZS5kb2VzRmlsdGVyUGFzcyA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgIGlmICghdGhpcy5maWx0ZXJUZXh0KSB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICB2YXIgdmFsdWUgPSBub2RlLnZhbHVlO1xyXG4gICAgaWYgKCF2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHZhciB2YWx1ZUxvd2VyQ2FzZSA9IHZhbHVlLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKTtcclxuICAgIHN3aXRjaCAodGhpcy5maWx0ZXJUeXBlKSB7XHJcbiAgICAgICAgY2FzZSBDT05UQUlOUzpcclxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlTG93ZXJDYXNlLmluZGV4T2YodGhpcy5maWx0ZXJUZXh0KSA+PSAwO1xyXG4gICAgICAgIGNhc2UgRVFVQUxTOlxyXG4gICAgICAgICAgICByZXR1cm4gdmFsdWVMb3dlckNhc2UgPT09IHRoaXMuZmlsdGVyVGV4dDtcclxuICAgICAgICBjYXNlIFNUQVJUU19XSVRIOlxyXG4gICAgICAgICAgICByZXR1cm4gdmFsdWVMb3dlckNhc2UuaW5kZXhPZih0aGlzLmZpbHRlclRleHQpID09PSAwO1xyXG4gICAgICAgIGNhc2UgRU5EU19XSVRIOlxyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSB2YWx1ZUxvd2VyQ2FzZS5pbmRleE9mKHRoaXMuZmlsdGVyVGV4dCk7XHJcbiAgICAgICAgICAgIHJldHVybiBpbmRleCA+PSAwICYmIGluZGV4ID09PSAodmFsdWVMb3dlckNhc2UubGVuZ3RoIC0gdGhpcy5maWx0ZXJUZXh0Lmxlbmd0aCk7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgLy8gc2hvdWxkIG5ldmVyIGhhcHBlblxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnaW52YWxpZCBmaWx0ZXIgdHlwZSAnICsgdGhpcy5maWx0ZXJUeXBlKTtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyogcHVibGljICovXHJcblRleHRGaWx0ZXIucHJvdG90eXBlLmdldEd1aSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZUd1aTtcclxufTtcclxuXHJcbi8qIHB1YmxpYyAqL1xyXG5UZXh0RmlsdGVyLnByb3RvdHlwZS5pc0ZpbHRlckFjdGl2ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZmlsdGVyVGV4dCAhPT0gbnVsbDtcclxufTtcclxuXHJcblRleHRGaWx0ZXIucHJvdG90eXBlLmNyZWF0ZUd1aSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5lR3VpID0gdXRpbHMubG9hZFRlbXBsYXRlKHRlbXBsYXRlKTtcclxuICAgIHRoaXMuZUZpbHRlclRleHRGaWVsZCA9IHRoaXMuZUd1aS5xdWVyeVNlbGVjdG9yKFwiI2ZpbHRlclRleHRcIik7XHJcbiAgICB0aGlzLmVUeXBlU2VsZWN0ID0gdGhpcy5lR3VpLnF1ZXJ5U2VsZWN0b3IoXCIjZmlsdGVyVHlwZVwiKTtcclxuXHJcbiAgICB1dGlscy5hZGRDaGFuZ2VMaXN0ZW5lcih0aGlzLmVGaWx0ZXJUZXh0RmllbGQsIHRoaXMub25GaWx0ZXJDaGFuZ2VkLmJpbmQodGhpcykpO1xyXG4gICAgdGhpcy5lVHlwZVNlbGVjdC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIHRoaXMub25UeXBlQ2hhbmdlZC5iaW5kKHRoaXMpKTtcclxufTtcclxuXHJcblRleHRGaWx0ZXIucHJvdG90eXBlLm9uVHlwZUNoYW5nZWQgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuZmlsdGVyVHlwZSA9IHBhcnNlSW50KHRoaXMuZVR5cGVTZWxlY3QudmFsdWUpO1xyXG4gICAgdGhpcy5maWx0ZXJDaGFuZ2VkQ2FsbGJhY2soKTtcclxufTtcclxuXHJcblRleHRGaWx0ZXIucHJvdG90eXBlLm9uRmlsdGVyQ2hhbmdlZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGZpbHRlclRleHQgPSB1dGlscy5tYWtlTnVsbCh0aGlzLmVGaWx0ZXJUZXh0RmllbGQudmFsdWUpO1xyXG4gICAgaWYgKGZpbHRlclRleHQgJiYgZmlsdGVyVGV4dC50cmltKCkgPT09ICcnKSB7XHJcbiAgICAgICAgZmlsdGVyVGV4dCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBpZiAoZmlsdGVyVGV4dCkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVyVGV4dCA9IGZpbHRlclRleHQudG9Mb3dlckNhc2UoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5maWx0ZXJUZXh0ID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMuZmlsdGVyQ2hhbmdlZENhbGxiYWNrKCk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFRleHRGaWx0ZXI7XHJcbiIsInZhciB0ZW1wbGF0ZSA9IFtcclxuICAgICc8ZGl2PicsXHJcbiAgICAnPGRpdj4nLFxyXG4gICAgJzxzZWxlY3QgY2xhc3M9XCJhZy1maWx0ZXItc2VsZWN0XCIgaWQ9XCJmaWx0ZXJUeXBlXCI+JyxcclxuICAgICc8b3B0aW9uIHZhbHVlPVwiMVwiPkNvbnRhaW5zPC9vcHRpb24+JyxcclxuICAgICc8b3B0aW9uIHZhbHVlPVwiMlwiPkVxdWFsczwvb3B0aW9uPicsXHJcbiAgICAnPG9wdGlvbiB2YWx1ZT1cIjNcIj5TdGFydHMgd2l0aDwvb3B0aW9uPicsXHJcbiAgICAnPG9wdGlvbiB2YWx1ZT1cIjRcIj5FbmRzIHdpdGg8L29wdGlvbj4nLFxyXG4gICAgJzwvc2VsZWN0PicsXHJcbiAgICAnPC9kaXY+JyxcclxuICAgICc8ZGl2PicsXHJcbiAgICAnPGlucHV0IGNsYXNzPVwiYWctZmlsdGVyLWZpbHRlclwiIGlkPVwiZmlsdGVyVGV4dFwiIHR5cGU9XCJ0ZXh0XCIgcGxhY2Vob2xkZXI9XCJmaWx0ZXIuLi5cIi8+JyxcclxuICAgICc8L2Rpdj4nLFxyXG4gICAgJzwvZGl2PicsXHJcbl0uam9pbignJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlO1xyXG4iLCJ2YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XHJcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xyXG52YXIgR3JpZE9wdGlvbnNXcmFwcGVyID0gcmVxdWlyZSgnLi9ncmlkT3B0aW9uc1dyYXBwZXInKTtcclxudmFyIHRlbXBsYXRlID0gcmVxdWlyZSgnLi90ZW1wbGF0ZS5qcycpO1xyXG52YXIgdGVtcGxhdGVOb1Njcm9sbHMgPSByZXF1aXJlKCcuL3RlbXBsYXRlTm9TY3JvbGxzLmpzJyk7XHJcbnZhciBTZWxlY3Rpb25Db250cm9sbGVyID0gcmVxdWlyZSgnLi9zZWxlY3Rpb25Db250cm9sbGVyJyk7XHJcbnZhciBGaWx0ZXJNYW5hZ2VyID0gcmVxdWlyZSgnLi9maWx0ZXIvZmlsdGVyTWFuYWdlcicpO1xyXG52YXIgU2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5ID0gcmVxdWlyZSgnLi9zZWxlY3Rpb25SZW5kZXJlckZhY3RvcnknKTtcclxudmFyIENvbHVtbkNvbnRyb2xsZXIgPSByZXF1aXJlKCcuL2NvbHVtbkNvbnRyb2xsZXInKTtcclxudmFyIFJvd1JlbmRlcmVyID0gcmVxdWlyZSgnLi9yb3dSZW5kZXJlcicpO1xyXG52YXIgSGVhZGVyUmVuZGVyZXIgPSByZXF1aXJlKCcuL2hlYWRlclJlbmRlcmVyJyk7XHJcbnZhciBJbk1lbW9yeVJvd0NvbnRyb2xsZXIgPSByZXF1aXJlKCcuL2luTWVtb3J5Um93Q29udHJvbGxlcicpO1xyXG52YXIgVmlydHVhbFBhZ2VSb3dDb250cm9sbGVyID0gcmVxdWlyZSgnLi92aXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXInKTtcclxudmFyIFBhZ2luYXRpb25Db250cm9sbGVyID0gcmVxdWlyZSgnLi9wYWdpbmF0aW9uQ29udHJvbGxlcicpO1xyXG52YXIgRXhwcmVzc2lvblNlcnZpY2UgPSByZXF1aXJlKCcuL2V4cHJlc3Npb25TZXJ2aWNlJyk7XHJcbnZhciBUZW1wbGF0ZVNlcnZpY2UgPSByZXF1aXJlKCcuL3RlbXBsYXRlU2VydmljZScpO1xyXG5cclxuZnVuY3Rpb24gR3JpZChlR3JpZERpdiwgZ3JpZE9wdGlvbnMsICRzY29wZSwgJGNvbXBpbGUpIHtcclxuXHJcbiAgICB0aGlzLmdyaWRPcHRpb25zID0gZ3JpZE9wdGlvbnM7XHJcbiAgICB0aGlzLmdyaWRPcHRpb25zV3JhcHBlciA9IG5ldyBHcmlkT3B0aW9uc1dyYXBwZXIodGhpcy5ncmlkT3B0aW9ucyk7XHJcblxyXG4gICAgdmFyIHVzZVNjcm9sbHMgPSAhdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNEb250VXNlU2Nyb2xscygpO1xyXG4gICAgaWYgKHVzZVNjcm9sbHMpIHtcclxuICAgICAgICBlR3JpZERpdi5pbm5lckhUTUwgPSB0ZW1wbGF0ZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZUdyaWREaXYuaW5uZXJIVE1MID0gdGVtcGxhdGVOb1Njcm9sbHM7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgdGhpcy5xdWlja0ZpbHRlciA9IG51bGw7XHJcblxyXG4gICAgLy8gaWYgdXNpbmcgYW5ndWxhciwgd2F0Y2ggZm9yIHF1aWNrRmlsdGVyIGNoYW5nZXNcclxuICAgIGlmICgkc2NvcGUpIHtcclxuICAgICAgICAkc2NvcGUuJHdhdGNoKFwiYW5ndWxhckdyaWQucXVpY2tGaWx0ZXJUZXh0XCIsIGZ1bmN0aW9uKG5ld0ZpbHRlcikge1xyXG4gICAgICAgICAgICB0aGF0Lm9uUXVpY2tGaWx0ZXJDaGFuZ2VkKG5ld0ZpbHRlcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy52aXJ0dWFsUm93Q2FsbGJhY2tzID0ge307XHJcblxyXG4gICAgdGhpcy5hZGRBcGkoKTtcclxuICAgIHRoaXMuZmluZEFsbEVsZW1lbnRzKGVHcmlkRGl2KTtcclxuICAgIHRoaXMuY3JlYXRlQW5kV2lyZUJlYW5zKCRzY29wZSwgJGNvbXBpbGUsIGVHcmlkRGl2LCB1c2VTY3JvbGxzKTtcclxuXHJcbiAgICB0aGlzLnNjcm9sbFdpZHRoID0gdXRpbHMuZ2V0U2Nyb2xsYmFyV2lkdGgoKTtcclxuXHJcbiAgICB0aGlzLmluTWVtb3J5Um93Q29udHJvbGxlci5zZXRBbGxSb3dzKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldEFsbFJvd3MoKSk7XHJcblxyXG4gICAgaWYgKHVzZVNjcm9sbHMpIHtcclxuICAgICAgICB0aGlzLmFkZFNjcm9sbExpc3RlbmVyKCk7XHJcbiAgICAgICAgdGhpcy5zZXRCb2R5U2l6ZSgpOyAvL3NldHRpbmcgc2l6ZXMgb2YgYm9keSAoY29udGFpbmluZyB2aWV3cG9ydHMpLCBkb2Vzbid0IGNoYW5nZSBjb250YWluZXIgc2l6ZXNcclxuICAgIH1cclxuXHJcbiAgICAvLyBkb25lIHdoZW4gY29scyBjaGFuZ2VcclxuICAgIHRoaXMuc2V0dXBDb2x1bW5zKCk7XHJcblxyXG4gICAgLy8gZG9uZSB3aGVuIHJvd3MgY2hhbmdlXHJcbiAgICB0aGlzLnVwZGF0ZU1vZGVsQW5kUmVmcmVzaChjb25zdGFudHMuU1RFUF9FVkVSWVRISU5HKTtcclxuXHJcbiAgICAvLyBmbGFnIHRvIG1hcmsgd2hlbiB0aGUgZGlyZWN0aXZlIGlzIGRlc3Ryb3llZFxyXG4gICAgdGhpcy5maW5pc2hlZCA9IGZhbHNlO1xyXG5cclxuICAgIC8vIGlmIG5vIGRhdGEgcHJvdmlkZWQgaW5pdGlhbGx5LCBhbmQgbm90IGRvaW5nIGluZmluaXRlIHNjcm9sbGluZywgc2hvdyB0aGUgbG9hZGluZyBwYW5lbFxyXG4gICAgdmFyIHNob3dMb2FkaW5nID0gIXRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldEFsbFJvd3MoKSAmJiAhdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNWaXJ0dWFsUGFnaW5nKCk7XHJcbiAgICB0aGlzLnNob3dMb2FkaW5nUGFuZWwoc2hvd0xvYWRpbmcpO1xyXG5cclxuICAgIC8vIGlmIGRhdGFzb3VyY2UgcHJvdmlkZWQsIHVzZSBpdFxyXG4gICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldERhdGFzb3VyY2UoKSkge1xyXG4gICAgICAgIHRoaXMuc2V0RGF0YXNvdXJjZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGlmIHJlYWR5IGZ1bmN0aW9uIHByb3ZpZGVkLCB1c2UgaXRcclxuICAgIGlmICh0eXBlb2YgdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0UmVhZHkoKSA9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0UmVhZHkoKShncmlkT3B0aW9ucy5hcGkpO1xyXG4gICAgfVxyXG59XHJcblxyXG5HcmlkLnByb3RvdHlwZS5jcmVhdGVBbmRXaXJlQmVhbnMgPSBmdW5jdGlvbigkc2NvcGUsICRjb21waWxlLCBlR3JpZERpdiwgdXNlU2Nyb2xscykge1xyXG5cclxuICAgIC8vIG1ha2UgbG9jYWwgcmVmZXJlbmNlcywgdG8gbWFrZSB0aGUgYmVsb3cgbW9yZSBodW1hbiByZWFkYWJsZVxyXG4gICAgdmFyIGdyaWRPcHRpb25zV3JhcHBlciA9IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyO1xyXG4gICAgdmFyIGdyaWRPcHRpb25zID0gdGhpcy5ncmlkT3B0aW9ucztcclxuXHJcbiAgICAvLyBjcmVhdGUgYWxsIHRoZSBiZWFuc1xyXG4gICAgdmFyIHNlbGVjdGlvbkNvbnRyb2xsZXIgPSBuZXcgU2VsZWN0aW9uQ29udHJvbGxlcigpO1xyXG4gICAgdmFyIGZpbHRlck1hbmFnZXIgPSBuZXcgRmlsdGVyTWFuYWdlcigpO1xyXG4gICAgdmFyIHNlbGVjdGlvblJlbmRlcmVyRmFjdG9yeSA9IG5ldyBTZWxlY3Rpb25SZW5kZXJlckZhY3RvcnkoKTtcclxuICAgIHZhciBjb2x1bW5Db250cm9sbGVyID0gbmV3IENvbHVtbkNvbnRyb2xsZXIoKTtcclxuICAgIHZhciByb3dSZW5kZXJlciA9IG5ldyBSb3dSZW5kZXJlcigpO1xyXG4gICAgdmFyIGhlYWRlclJlbmRlcmVyID0gbmV3IEhlYWRlclJlbmRlcmVyKCk7XHJcbiAgICB2YXIgaW5NZW1vcnlSb3dDb250cm9sbGVyID0gbmV3IEluTWVtb3J5Um93Q29udHJvbGxlcigpO1xyXG4gICAgdmFyIHZpcnR1YWxQYWdlUm93Q29udHJvbGxlciA9IG5ldyBWaXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXIoKTtcclxuICAgIHZhciBleHByZXNzaW9uU2VydmljZSA9IG5ldyBFeHByZXNzaW9uU2VydmljZSgpO1xyXG4gICAgdmFyIHRlbXBsYXRlU2VydmljZSA9IG5ldyBUZW1wbGF0ZVNlcnZpY2UoKTtcclxuXHJcbiAgICB2YXIgY29sdW1uTW9kZWwgPSBjb2x1bW5Db250cm9sbGVyLmdldE1vZGVsKCk7XHJcblxyXG4gICAgLy8gaW5pdGlhbGlzZSBhbGwgdGhlIGJlYW5zXHJcbiAgICB0ZW1wbGF0ZVNlcnZpY2UuaW5pdCgkc2NvcGUpO1xyXG4gICAgc2VsZWN0aW9uQ29udHJvbGxlci5pbml0KHRoaXMsIHRoaXMuZVBhcmVudE9mUm93cywgZ3JpZE9wdGlvbnNXcmFwcGVyLCAkc2NvcGUsIHJvd1JlbmRlcmVyKTtcclxuICAgIGZpbHRlck1hbmFnZXIuaW5pdCh0aGlzLCBncmlkT3B0aW9uc1dyYXBwZXIsICRjb21waWxlLCAkc2NvcGUpO1xyXG4gICAgc2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5LmluaXQodGhpcywgc2VsZWN0aW9uQ29udHJvbGxlcik7XHJcbiAgICBjb2x1bW5Db250cm9sbGVyLmluaXQodGhpcywgc2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5LCBncmlkT3B0aW9uc1dyYXBwZXIpO1xyXG4gICAgcm93UmVuZGVyZXIuaW5pdChncmlkT3B0aW9ucywgY29sdW1uTW9kZWwsIGdyaWRPcHRpb25zV3JhcHBlciwgZUdyaWREaXYsIHRoaXMsXHJcbiAgICAgICAgc2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5LCAkY29tcGlsZSwgJHNjb3BlLCBzZWxlY3Rpb25Db250cm9sbGVyLCBleHByZXNzaW9uU2VydmljZSwgdGVtcGxhdGVTZXJ2aWNlLFxyXG4gICAgICAgIHRoaXMuZVBhcmVudE9mUm93cyk7XHJcbiAgICBoZWFkZXJSZW5kZXJlci5pbml0KGdyaWRPcHRpb25zV3JhcHBlciwgY29sdW1uQ29udHJvbGxlciwgY29sdW1uTW9kZWwsIGVHcmlkRGl2LCB0aGlzLCBmaWx0ZXJNYW5hZ2VyLCAkc2NvcGUsICRjb21waWxlKTtcclxuICAgIGluTWVtb3J5Um93Q29udHJvbGxlci5pbml0KGdyaWRPcHRpb25zV3JhcHBlciwgY29sdW1uTW9kZWwsIHRoaXMsIGZpbHRlck1hbmFnZXIsICRzY29wZSwgZXhwcmVzc2lvblNlcnZpY2UpO1xyXG4gICAgdmlydHVhbFBhZ2VSb3dDb250cm9sbGVyLmluaXQocm93UmVuZGVyZXIpO1xyXG5cclxuICAgIC8vIHRoaXMgaXMgYSBjaGlsZCBiZWFuLCBnZXQgYSByZWZlcmVuY2UgYW5kIHBhc3MgaXQgb25cclxuICAgIC8vIENBTiBXRSBERUxFVEUgVEhJUz8gaXQncyBkb25lIGluIHRoZSBzZXREYXRhc291cmNlIHNlY3Rpb25cclxuICAgIHZhciByb3dNb2RlbCA9IGluTWVtb3J5Um93Q29udHJvbGxlci5nZXRNb2RlbCgpO1xyXG4gICAgc2VsZWN0aW9uQ29udHJvbGxlci5zZXRSb3dNb2RlbChyb3dNb2RlbCk7XHJcbiAgICBmaWx0ZXJNYW5hZ2VyLnNldFJvd01vZGVsKHJvd01vZGVsKTtcclxuICAgIHJvd1JlbmRlcmVyLnNldFJvd01vZGVsKHJvd01vZGVsKTtcclxuXHJcbiAgICAvLyBhbmQgdGhlIGxhc3QgYmVhbiwgZG9uZSBpbiBpdCdzIG93biBzZWN0aW9uLCBhcyBpdCdzIG9wdGlvbmFsXHJcbiAgICB2YXIgcGFnaW5hdGlvbkNvbnRyb2xsZXIgPSBudWxsO1xyXG4gICAgaWYgKHVzZVNjcm9sbHMpIHtcclxuICAgICAgICBwYWdpbmF0aW9uQ29udHJvbGxlciA9IG5ldyBQYWdpbmF0aW9uQ29udHJvbGxlcigpO1xyXG4gICAgICAgIHBhZ2luYXRpb25Db250cm9sbGVyLmluaXQodGhpcy5lUGFnaW5nUGFuZWwsIHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucm93TW9kZWwgPSByb3dNb2RlbDtcclxuICAgIHRoaXMuc2VsZWN0aW9uQ29udHJvbGxlciA9IHNlbGVjdGlvbkNvbnRyb2xsZXI7XHJcbiAgICB0aGlzLmNvbHVtbkNvbnRyb2xsZXIgPSBjb2x1bW5Db250cm9sbGVyO1xyXG4gICAgdGhpcy5jb2x1bW5Nb2RlbCA9IGNvbHVtbk1vZGVsO1xyXG4gICAgdGhpcy5pbk1lbW9yeVJvd0NvbnRyb2xsZXIgPSBpbk1lbW9yeVJvd0NvbnRyb2xsZXI7XHJcbiAgICB0aGlzLnZpcnR1YWxQYWdlUm93Q29udHJvbGxlciA9IHZpcnR1YWxQYWdlUm93Q29udHJvbGxlcjtcclxuICAgIHRoaXMucm93UmVuZGVyZXIgPSByb3dSZW5kZXJlcjtcclxuICAgIHRoaXMuaGVhZGVyUmVuZGVyZXIgPSBoZWFkZXJSZW5kZXJlcjtcclxuICAgIHRoaXMucGFnaW5hdGlvbkNvbnRyb2xsZXIgPSBwYWdpbmF0aW9uQ29udHJvbGxlcjtcclxuICAgIHRoaXMuZmlsdGVyTWFuYWdlciA9IGZpbHRlck1hbmFnZXI7XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5zaG93QW5kUG9zaXRpb25QYWdpbmdQYW5lbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgLy8gbm8gcGFnaW5nIHdoZW4gbm8tc2Nyb2xsc1xyXG4gICAgaWYgKCF0aGlzLmVQYWdpbmdQYW5lbCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5pc1Nob3dQYWdpbmdQYW5lbCgpKSB7XHJcbiAgICAgICAgdGhpcy5lUGFnaW5nUGFuZWwuc3R5bGVbJ2Rpc3BsYXknXSA9IG51bGw7XHJcbiAgICAgICAgdmFyIGhlaWdodE9mUGFnZXIgPSB0aGlzLmVQYWdpbmdQYW5lbC5vZmZzZXRIZWlnaHQ7XHJcbiAgICAgICAgdGhpcy5lQm9keS5zdHlsZVsncGFkZGluZy1ib3R0b20nXSA9IGhlaWdodE9mUGFnZXIgKyAncHgnO1xyXG4gICAgICAgIHZhciBoZWlnaHRPZlJvb3QgPSB0aGlzLmVSb290LmNsaWVudEhlaWdodDtcclxuICAgICAgICB2YXIgdG9wT2ZQYWdlciA9IGhlaWdodE9mUm9vdCAtIGhlaWdodE9mUGFnZXI7XHJcbiAgICAgICAgdGhpcy5lUGFnaW5nUGFuZWwuc3R5bGVbJ3RvcCddID0gdG9wT2ZQYWdlciArICdweCc7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuZVBhZ2luZ1BhbmVsLnN0eWxlWydkaXNwbGF5J10gPSAnbm9uZSc7XHJcbiAgICAgICAgdGhpcy5lQm9keS5zdHlsZVsncGFkZGluZy1ib3R0b20nXSA9IG51bGw7XHJcbiAgICB9XHJcblxyXG59O1xyXG5cclxuR3JpZC5wcm90b3R5cGUuaXNTaG93UGFnaW5nUGFuZWwgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLnNob3dQYWdpbmdQYW5lbDtcclxufTtcclxuXHJcbkdyaWQucHJvdG90eXBlLnNldERhdGFzb3VyY2UgPSBmdW5jdGlvbihkYXRhc291cmNlKSB7XHJcbiAgICAvLyBpZiBkYXRhc291cmNlIHByb3ZpZGVkLCB0aGVuIHNldCBpdFxyXG4gICAgaWYgKGRhdGFzb3VyY2UpIHtcclxuICAgICAgICB0aGlzLmdyaWRPcHRpb25zLmRhdGFzb3VyY2UgPSBkYXRhc291cmNlO1xyXG4gICAgfVxyXG4gICAgLy8gZ2V0IHRoZSBzZXQgZGF0YXNvdXJjZSAoaWYgbnVsbCB3YXMgcGFzc2VkIHRvIHRoaXMgbWV0aG9kLFxyXG4gICAgLy8gdGhlbiBuZWVkIHRvIGdldCB0aGUgYWN0dWFsIGRhdGFzb3VyY2UgZnJvbSBvcHRpb25zXHJcbiAgICB2YXIgZGF0YXNvdXJjZVRvVXNlID0gdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0RGF0YXNvdXJjZSgpO1xyXG4gICAgdmFyIHZpcnR1YWxQYWdpbmcgPSB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc1ZpcnR1YWxQYWdpbmcoKSAmJiBkYXRhc291cmNlVG9Vc2U7XHJcbiAgICB2YXIgcGFnaW5hdGlvbiA9IGRhdGFzb3VyY2VUb1VzZSAmJiAhdmlydHVhbFBhZ2luZztcclxuXHJcbiAgICBpZiAodmlydHVhbFBhZ2luZykge1xyXG4gICAgICAgIHRoaXMucGFnaW5hdGlvbkNvbnRyb2xsZXIuc2V0RGF0YXNvdXJjZShudWxsKTtcclxuICAgICAgICB0aGlzLnZpcnR1YWxQYWdlUm93Q29udHJvbGxlci5zZXREYXRhc291cmNlKGRhdGFzb3VyY2VUb1VzZSk7XHJcbiAgICAgICAgdGhpcy5yb3dNb2RlbCA9IHRoaXMudmlydHVhbFBhZ2VSb3dDb250cm9sbGVyLmdldE1vZGVsKCk7XHJcbiAgICAgICAgdGhpcy5zaG93UGFnaW5nUGFuZWwgPSBmYWxzZTtcclxuICAgIH0gZWxzZSBpZiAocGFnaW5hdGlvbikge1xyXG4gICAgICAgIHRoaXMucGFnaW5hdGlvbkNvbnRyb2xsZXIuc2V0RGF0YXNvdXJjZShkYXRhc291cmNlVG9Vc2UpO1xyXG4gICAgICAgIHRoaXMudmlydHVhbFBhZ2VSb3dDb250cm9sbGVyLnNldERhdGFzb3VyY2UobnVsbCk7XHJcbiAgICAgICAgdGhpcy5yb3dNb2RlbCA9IHRoaXMuaW5NZW1vcnlSb3dDb250cm9sbGVyLmdldE1vZGVsKCk7XHJcbiAgICAgICAgdGhpcy5zaG93UGFnaW5nUGFuZWwgPSB0cnVlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLnBhZ2luYXRpb25Db250cm9sbGVyLnNldERhdGFzb3VyY2UobnVsbCk7XHJcbiAgICAgICAgdGhpcy52aXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXIuc2V0RGF0YXNvdXJjZShudWxsKTtcclxuICAgICAgICB0aGlzLnJvd01vZGVsID0gdGhpcy5pbk1lbW9yeVJvd0NvbnRyb2xsZXIuZ2V0TW9kZWwoKTtcclxuICAgICAgICB0aGlzLnNob3dQYWdpbmdQYW5lbCA9IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuc2VsZWN0aW9uQ29udHJvbGxlci5zZXRSb3dNb2RlbCh0aGlzLnJvd01vZGVsKTtcclxuICAgIHRoaXMuZmlsdGVyTWFuYWdlci5zZXRSb3dNb2RlbCh0aGlzLnJvd01vZGVsKTtcclxuICAgIHRoaXMucm93UmVuZGVyZXIuc2V0Um93TW9kZWwodGhpcy5yb3dNb2RlbCk7XHJcblxyXG4gICAgLy8gd2UgbWF5IG9mIGp1c3Qgc2hvd24gb3IgaGlkZGVuIHRoZSBwYWdpbmcgcGFuZWwsIHNvIG5lZWRcclxuICAgIC8vIHRvIGdldCB0YWJsZSB0byBjaGVjayB0aGUgYm9keSBzaXplLCB3aGljaCBhbHNvIGhpZGVzIGFuZFxyXG4gICAgLy8gc2hvd3MgdGhlIHBhZ2luZyBwYW5lbC5cclxuICAgIHRoaXMuc2V0Qm9keVNpemUoKTtcclxuXHJcbiAgICAvLyBiZWNhdXNlIHdlIGp1c3Qgc2V0IHRoZSByb3dNb2RlbCwgbmVlZCB0byB1cGRhdGUgdGhlIGd1aVxyXG4gICAgdGhpcy5yb3dSZW5kZXJlci5yZWZyZXNoVmlldygpO1xyXG59O1xyXG5cclxuLy8gZ2V0cyBjYWxsZWQgYWZ0ZXIgY29sdW1ucyBhcmUgc2hvd24gLyBoaWRkZW4gZnJvbSBncm91cHMgZXhwYW5kaW5nXHJcbkdyaWQucHJvdG90eXBlLnJlZnJlc2hIZWFkZXJBbmRCb2R5ID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmhlYWRlclJlbmRlcmVyLnJlZnJlc2hIZWFkZXIoKTtcclxuICAgIHRoaXMuaGVhZGVyUmVuZGVyZXIudXBkYXRlRmlsdGVySWNvbnMoKTtcclxuICAgIHRoaXMuc2V0Qm9keUNvbnRhaW5lcldpZHRoKCk7XHJcbiAgICB0aGlzLnNldFBpbm5lZENvbENvbnRhaW5lcldpZHRoKCk7XHJcbiAgICB0aGlzLnJvd1JlbmRlcmVyLnJlZnJlc2hWaWV3KCk7XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5zZXRGaW5pc2hlZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5maW5pc2hlZCA9IHRydWU7XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5nZXRQb3B1cFBhcmVudCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZVJvb3Q7XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5nZXRRdWlja0ZpbHRlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMucXVpY2tGaWx0ZXI7XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5vblF1aWNrRmlsdGVyQ2hhbmdlZCA9IGZ1bmN0aW9uKG5ld0ZpbHRlcikge1xyXG4gICAgaWYgKG5ld0ZpbHRlciA9PT0gdW5kZWZpbmVkIHx8IG5ld0ZpbHRlciA9PT0gXCJcIikge1xyXG4gICAgICAgIG5ld0ZpbHRlciA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5xdWlja0ZpbHRlciAhPT0gbmV3RmlsdGVyKSB7XHJcbiAgICAgICAgLy93YW50ICdudWxsJyB0byBtZWFuIHRvIGZpbHRlciwgc28gcmVtb3ZlIHVuZGVmaW5lZCBhbmQgZW1wdHkgc3RyaW5nXHJcbiAgICAgICAgaWYgKG5ld0ZpbHRlciA9PT0gdW5kZWZpbmVkIHx8IG5ld0ZpbHRlciA9PT0gXCJcIikge1xyXG4gICAgICAgICAgICBuZXdGaWx0ZXIgPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobmV3RmlsdGVyICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIG5ld0ZpbHRlciA9IG5ld0ZpbHRlci50b1VwcGVyQ2FzZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnF1aWNrRmlsdGVyID0gbmV3RmlsdGVyO1xyXG4gICAgICAgIHRoaXMub25GaWx0ZXJDaGFuZ2VkKCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5vbkZpbHRlckNoYW5nZWQgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMudXBkYXRlTW9kZWxBbmRSZWZyZXNoKGNvbnN0YW50cy5TVEVQX0ZJTFRFUik7XHJcbiAgICB0aGlzLmhlYWRlclJlbmRlcmVyLnVwZGF0ZUZpbHRlckljb25zKCk7XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5vblJvd0NsaWNrZWQgPSBmdW5jdGlvbihldmVudCwgcm93SW5kZXgsIG5vZGUpIHtcclxuXHJcbiAgICBpZiAodGhpcy5ncmlkT3B0aW9ucy5yb3dDbGlja2VkKSB7XHJcbiAgICAgICAgdmFyIHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbm9kZTogbm9kZSxcclxuICAgICAgICAgICAgZGF0YTogbm9kZS5kYXRhLFxyXG4gICAgICAgICAgICBldmVudDogZXZlbnRcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuZ3JpZE9wdGlvbnMucm93Q2xpY2tlZChwYXJhbXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIHdlIGRvIG5vdCBhbGxvdyBzZWxlY3RpbmcgZ3JvdXBzIGJ5IGNsaWNraW5nIChhcyB0aGUgY2xpY2sgaGVyZSBleHBhbmRzIHRoZSBncm91cClcclxuICAgIC8vIHNvIHJldHVybiBpZiBpdCdzIGEgZ3JvdXAgcm93XHJcbiAgICBpZiAobm9kZS5ncm91cCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBpZiBubyBzZWxlY3Rpb24gbWV0aG9kIGVuYWJsZWQsIGRvIG5vdGhpbmdcclxuICAgIGlmICghdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNSb3dTZWxlY3Rpb24oKSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBpZiBjbGljayBzZWxlY3Rpb24gc3VwcHJlc3NlZCwgZG8gbm90aGluZ1xyXG4gICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzU3VwcHJlc3NSb3dDbGlja1NlbGVjdGlvbigpKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGN0cmxLZXkgZm9yIHdpbmRvd3MsIG1ldGFLZXkgZm9yIEFwcGxlXHJcbiAgICB2YXIgdHJ5TXVsdGkgPSBldmVudC5jdHJsS2V5IHx8IGV2ZW50Lm1ldGFLZXk7XHJcbiAgICB0aGlzLnNlbGVjdGlvbkNvbnRyb2xsZXIuc2VsZWN0Tm9kZShub2RlLCB0cnlNdWx0aSk7XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5zZXRIZWFkZXJIZWlnaHQgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBoZWFkZXJIZWlnaHQgPSB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRIZWFkZXJIZWlnaHQoKTtcclxuICAgIHZhciBoZWFkZXJIZWlnaHRQaXhlbHMgPSBoZWFkZXJIZWlnaHQgKyAncHgnO1xyXG4gICAgdmFyIGRvbnRVc2VTY3JvbGxzID0gdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNEb250VXNlU2Nyb2xscygpO1xyXG4gICAgaWYgKGRvbnRVc2VTY3JvbGxzKSB7XHJcbiAgICAgICAgdGhpcy5lSGVhZGVyQ29udGFpbmVyLnN0eWxlWydoZWlnaHQnXSA9IGhlYWRlckhlaWdodFBpeGVscztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5lSGVhZGVyLnN0eWxlWydoZWlnaHQnXSA9IGhlYWRlckhlaWdodFBpeGVscztcclxuICAgICAgICB0aGlzLmVCb2R5LnN0eWxlWydwYWRkaW5nLXRvcCddID0gaGVhZGVySGVpZ2h0UGl4ZWxzO1xyXG4gICAgICAgIHRoaXMuZUxvYWRpbmdQYW5lbC5zdHlsZVsnbWFyZ2luLXRvcCddID0gaGVhZGVySGVpZ2h0UGl4ZWxzO1xyXG4gICAgfVxyXG59O1xyXG5cclxuR3JpZC5wcm90b3R5cGUuc2hvd0xvYWRpbmdQYW5lbCA9IGZ1bmN0aW9uKHNob3cpIHtcclxuICAgIGlmIChzaG93KSB7XHJcbiAgICAgICAgLy8gc2V0dGluZyBkaXNwbGF5IHRvIG51bGwsIGFjdHVhbGx5IGhhcyB0aGUgaW1wYWN0IG9mIHNldHRpbmcgaXRcclxuICAgICAgICAvLyB0byAndGFibGUnLCBhcyB0aGlzIGlzIHBhcnQgb2YgdGhlIGFnLWxvYWRpbmctcGFuZWwgY29yZSBzdHlsZVxyXG4gICAgICAgIHRoaXMuZUxvYWRpbmdQYW5lbC5zdHlsZS5kaXNwbGF5ID0gbnVsbDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5lTG9hZGluZ1BhbmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICB9XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5zZXR1cENvbHVtbnMgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuc2V0SGVhZGVySGVpZ2h0KCk7XHJcbiAgICB0aGlzLmNvbHVtbkNvbnRyb2xsZXIuc2V0Q29sdW1ucyh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRDb2x1bW5EZWZzKCkpO1xyXG4gICAgdGhpcy5zaG93UGlubmVkQ29sQ29udGFpbmVyc0lmTmVlZGVkKCk7XHJcbiAgICB0aGlzLmhlYWRlclJlbmRlcmVyLnJlZnJlc2hIZWFkZXIoKTtcclxuICAgIGlmICghdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNEb250VXNlU2Nyb2xscygpKSB7XHJcbiAgICAgICAgdGhpcy5zZXRQaW5uZWRDb2xDb250YWluZXJXaWR0aCgpO1xyXG4gICAgICAgIHRoaXMuc2V0Qm9keUNvbnRhaW5lcldpZHRoKCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmhlYWRlclJlbmRlcmVyLnVwZGF0ZUZpbHRlckljb25zKCk7XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5zZXRCb2R5Q29udGFpbmVyV2lkdGggPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBtYWluUm93V2lkdGggPSB0aGlzLmNvbHVtbk1vZGVsLmdldEJvZHlDb250YWluZXJXaWR0aCgpICsgXCJweFwiO1xyXG4gICAgdGhpcy5lQm9keUNvbnRhaW5lci5zdHlsZS53aWR0aCA9IG1haW5Sb3dXaWR0aDtcclxufTtcclxuXHJcbkdyaWQucHJvdG90eXBlLnVwZGF0ZU1vZGVsQW5kUmVmcmVzaCA9IGZ1bmN0aW9uKHN0ZXApIHtcclxuICAgIHRoaXMuaW5NZW1vcnlSb3dDb250cm9sbGVyLnVwZGF0ZU1vZGVsKHN0ZXApO1xyXG4gICAgdGhpcy5yb3dSZW5kZXJlci5yZWZyZXNoVmlldygpO1xyXG59O1xyXG5cclxuR3JpZC5wcm90b3R5cGUuc2V0Um93cyA9IGZ1bmN0aW9uKHJvd3MsIGZpcnN0SWQpIHtcclxuICAgIGlmIChyb3dzKSB7XHJcbiAgICAgICAgdGhpcy5ncmlkT3B0aW9ucy5yb3dEYXRhID0gcm93cztcclxuICAgIH1cclxuICAgIHRoaXMuaW5NZW1vcnlSb3dDb250cm9sbGVyLnNldEFsbFJvd3ModGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0QWxsUm93cygpLCBmaXJzdElkKTtcclxuICAgIHRoaXMuc2VsZWN0aW9uQ29udHJvbGxlci5kZXNlbGVjdEFsbCgpO1xyXG4gICAgdGhpcy5maWx0ZXJNYW5hZ2VyLm9uTmV3Um93c0xvYWRlZCgpO1xyXG4gICAgdGhpcy51cGRhdGVNb2RlbEFuZFJlZnJlc2goY29uc3RhbnRzLlNURVBfRVZFUllUSElORyk7XHJcbiAgICB0aGlzLmhlYWRlclJlbmRlcmVyLnVwZGF0ZUZpbHRlckljb25zKCk7XHJcbiAgICB0aGlzLnNob3dMb2FkaW5nUGFuZWwoZmFsc2UpO1xyXG59O1xyXG5cclxuR3JpZC5wcm90b3R5cGUuZW5zdXJlTm9kZVZpc2libGUgPSBmdW5jdGlvbihjb21wYXJhdG9yKSB7XHJcbiAgICAvLyBsb29rIGZvciB0aGUgbm9kZSBpbmRleCB3ZSB3YW50IHRvIGRpc3BsYXlcclxuICAgIHZhciByb3dDb3VudCA9IHRoaXMucm93TW9kZWwuZ2V0VmlydHVhbFJvd0NvdW50KCk7XHJcbiAgICB2YXIgY29tcGFyYXRvcklzQUZ1bmN0aW9uID0gdHlwZW9mIGNvbXBhcmF0b3IgPT09ICdmdW5jdGlvbic7XHJcbiAgICB2YXIgaW5kZXhUb1NlbGVjdCA9IC0xO1xyXG4gICAgLy8gZ28gdGhyb3VnaCBhbGwgdGhlIG5vZGVzLCBmaW5kIHRoZSBvbmUgd2Ugd2FudCB0byBzaG93XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJvd0NvdW50OyBpKyspIHtcclxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMucm93TW9kZWwuZ2V0VmlydHVhbFJvdyhpKTtcclxuICAgICAgICBpZiAoY29tcGFyYXRvcklzQUZ1bmN0aW9uKSB7XHJcbiAgICAgICAgICAgIGlmIChjb21wYXJhdG9yKG5vZGUpKSB7XHJcbiAgICAgICAgICAgICAgICBpbmRleFRvU2VsZWN0ID0gaTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gY2hlY2sgb2JqZWN0IGVxdWFsaXR5IGFnYWluc3Qgbm9kZSBhbmQgZGF0YVxyXG4gICAgICAgICAgICBpZiAoY29tcGFyYXRvciA9PT0gbm9kZSB8fCBjb21wYXJhdG9yID09PSBub2RlLmRhdGEpIHtcclxuICAgICAgICAgICAgICAgIGluZGV4VG9TZWxlY3QgPSBpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAoaW5kZXhUb1NlbGVjdCA+PSAwKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVJbmRleFZpc2libGUoaW5kZXhUb1NlbGVjdCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5lbnN1cmVJbmRleFZpc2libGUgPSBmdW5jdGlvbihpbmRleCkge1xyXG4gICAgdmFyIGxhc3RSb3cgPSB0aGlzLnJvd01vZGVsLmdldFZpcnR1YWxSb3dDb3VudCgpO1xyXG4gICAgaWYgKHR5cGVvZiBpbmRleCAhPT0gJ251bWJlcicgfHwgaW5kZXggPCAwIHx8IGluZGV4ID49IGxhc3RSb3cpIHtcclxuICAgICAgICB0aHJvdyAnaW52YWxpZCByb3cgaW5kZXggZm9yIGVuc3VyZUluZGV4VmlzaWJsZTogJyArIGluZGV4O1xyXG4gICAgfVxyXG5cclxuICAgIHZhciByb3dIZWlnaHQgPSB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRSb3dIZWlnaHQoKTtcclxuICAgIHZhciByb3dUb3BQaXhlbCA9IHJvd0hlaWdodCAqIGluZGV4O1xyXG4gICAgdmFyIHJvd0JvdHRvbVBpeGVsID0gcm93VG9wUGl4ZWwgKyByb3dIZWlnaHQ7XHJcblxyXG4gICAgdmFyIHZpZXdwb3J0VG9wUGl4ZWwgPSB0aGlzLmVCb2R5Vmlld3BvcnQuc2Nyb2xsVG9wO1xyXG4gICAgdmFyIHZpZXdwb3J0SGVpZ2h0ID0gdGhpcy5lQm9keVZpZXdwb3J0Lm9mZnNldEhlaWdodDtcclxuICAgIHZhciBzY3JvbGxTaG93aW5nID0gdGhpcy5lQm9keVZpZXdwb3J0LmNsaWVudFdpZHRoIDwgdGhpcy5lQm9keVZpZXdwb3J0LnNjcm9sbFdpZHRoO1xyXG4gICAgaWYgKHNjcm9sbFNob3dpbmcpIHtcclxuICAgICAgICB2aWV3cG9ydEhlaWdodCAtPSB0aGlzLnNjcm9sbFdpZHRoO1xyXG4gICAgfVxyXG4gICAgdmFyIHZpZXdwb3J0Qm90dG9tUGl4ZWwgPSB2aWV3cG9ydFRvcFBpeGVsICsgdmlld3BvcnRIZWlnaHQ7XHJcblxyXG4gICAgdmFyIHZpZXdwb3J0U2Nyb2xsZWRQYXN0Um93ID0gdmlld3BvcnRUb3BQaXhlbCA+IHJvd1RvcFBpeGVsO1xyXG4gICAgdmFyIHZpZXdwb3J0U2Nyb2xsZWRCZWZvcmVSb3cgPSB2aWV3cG9ydEJvdHRvbVBpeGVsIDwgcm93Qm90dG9tUGl4ZWw7XHJcblxyXG4gICAgaWYgKHZpZXdwb3J0U2Nyb2xsZWRQYXN0Um93KSB7XHJcbiAgICAgICAgLy8gaWYgcm93IGlzIGJlZm9yZSwgc2Nyb2xsIHVwIHdpdGggcm93IGF0IHRvcFxyXG4gICAgICAgIHRoaXMuZUJvZHlWaWV3cG9ydC5zY3JvbGxUb3AgPSByb3dUb3BQaXhlbDtcclxuICAgIH0gZWxzZSBpZiAodmlld3BvcnRTY3JvbGxlZEJlZm9yZVJvdykge1xyXG4gICAgICAgIC8vIGlmIHJvdyBpcyBiZWxvdywgc2Nyb2xsIGRvd24gd2l0aCByb3cgYXQgYm90dG9tXHJcbiAgICAgICAgdmFyIG5ld1Njcm9sbFBvc2l0aW9uID0gcm93Qm90dG9tUGl4ZWwgLSB2aWV3cG9ydEhlaWdodDtcclxuICAgICAgICB0aGlzLmVCb2R5Vmlld3BvcnQuc2Nyb2xsVG9wID0gbmV3U2Nyb2xsUG9zaXRpb247XHJcbiAgICB9XHJcbiAgICAvLyBvdGhlcndpc2UsIHJvdyBpcyBhbHJlYWR5IGluIHZpZXcsIHNvIGRvIG5vdGhpbmdcclxufTtcclxuXHJcbkdyaWQucHJvdG90eXBlLmFkZEFwaSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgdmFyIGFwaSA9IHtcclxuICAgICAgICBzZXREYXRhc291cmNlOiBmdW5jdGlvbihkYXRhc291cmNlKSB7XHJcbiAgICAgICAgICAgIHRoYXQuc2V0RGF0YXNvdXJjZShkYXRhc291cmNlKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG9uTmV3RGF0YXNvdXJjZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoYXQuc2V0RGF0YXNvdXJjZSgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc2V0Um93czogZnVuY3Rpb24ocm93cykge1xyXG4gICAgICAgICAgICB0aGF0LnNldFJvd3Mocm93cyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBvbk5ld1Jvd3M6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGF0LnNldFJvd3MoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG9uTmV3Q29sczogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoYXQub25OZXdDb2xzKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB1bnNlbGVjdEFsbDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJ1bnNlbGVjdEFsbCBkZXByZWNhdGVkLCBjYWxsIGRlc2VsZWN0QWxsIGluc3RlYWRcIik7XHJcbiAgICAgICAgICAgIHRoaXMuZGVzZWxlY3RBbGwoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlZnJlc2hWaWV3OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdGhhdC5yb3dSZW5kZXJlci5yZWZyZXNoVmlldygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc29mdFJlZnJlc2hWaWV3OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdGhhdC5yb3dSZW5kZXJlci5zb2Z0UmVmcmVzaFZpZXcoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlZnJlc2hHcm91cFJvd3M6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGF0LnJvd1JlbmRlcmVyLnJlZnJlc2hHcm91cFJvd3MoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlZnJlc2hIZWFkZXI6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAvLyBuZWVkIHRvIHJldmlldyB0aGlzIC0gdGhlIHJlZnJlc2hIZWFkZXIgc2hvdWxkIGFsc28gcmVmcmVzaCBhbGwgaWNvbnMgaW4gdGhlIGhlYWRlclxyXG4gICAgICAgICAgICB0aGF0LmhlYWRlclJlbmRlcmVyLnJlZnJlc2hIZWFkZXIoKTtcclxuICAgICAgICAgICAgdGhhdC5oZWFkZXJSZW5kZXJlci51cGRhdGVGaWx0ZXJJY29ucygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZ2V0TW9kZWw6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhhdC5yb3dNb2RlbDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG9uR3JvdXBFeHBhbmRlZE9yQ29sbGFwc2VkOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdGhhdC51cGRhdGVNb2RlbEFuZFJlZnJlc2goY29uc3RhbnRzLlNURVBfTUFQKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGV4cGFuZEFsbDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoYXQuaW5NZW1vcnlSb3dDb250cm9sbGVyLmV4cGFuZE9yQ29sbGFwc2VBbGwodHJ1ZSwgbnVsbCk7XHJcbiAgICAgICAgICAgIHRoYXQudXBkYXRlTW9kZWxBbmRSZWZyZXNoKGNvbnN0YW50cy5TVEVQX01BUCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb2xsYXBzZUFsbDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoYXQuaW5NZW1vcnlSb3dDb250cm9sbGVyLmV4cGFuZE9yQ29sbGFwc2VBbGwoZmFsc2UsIG51bGwpO1xyXG4gICAgICAgICAgICB0aGF0LnVwZGF0ZU1vZGVsQW5kUmVmcmVzaChjb25zdGFudHMuU1RFUF9NQVApO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYWRkVmlydHVhbFJvd0xpc3RlbmVyOiBmdW5jdGlvbihyb3dJbmRleCwgY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgdGhhdC5hZGRWaXJ0dWFsUm93TGlzdGVuZXIocm93SW5kZXgsIGNhbGxiYWNrKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJvd0RhdGFDaGFuZ2VkOiBmdW5jdGlvbihyb3dzKSB7XHJcbiAgICAgICAgICAgIHRoYXQucm93UmVuZGVyZXIucm93RGF0YUNoYW5nZWQocm93cyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzZXRRdWlja0ZpbHRlcjogZnVuY3Rpb24obmV3RmlsdGVyKSB7XHJcbiAgICAgICAgICAgIHRoYXQub25RdWlja0ZpbHRlckNoYW5nZWQobmV3RmlsdGVyKVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc2VsZWN0SW5kZXg6IGZ1bmN0aW9uKGluZGV4LCB0cnlNdWx0aSwgc3VwcHJlc3NFdmVudHMpIHtcclxuICAgICAgICAgICAgdGhhdC5zZWxlY3Rpb25Db250cm9sbGVyLnNlbGVjdEluZGV4KGluZGV4LCB0cnlNdWx0aSwgc3VwcHJlc3NFdmVudHMpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZGVzZWxlY3RJbmRleDogZnVuY3Rpb24oaW5kZXgpIHtcclxuICAgICAgICAgICAgdGhhdC5zZWxlY3Rpb25Db250cm9sbGVyLmRlc2VsZWN0SW5kZXgoaW5kZXgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc2VsZWN0Tm9kZTogZnVuY3Rpb24obm9kZSwgdHJ5TXVsdGksIHN1cHByZXNzRXZlbnRzKSB7XHJcbiAgICAgICAgICAgIHRoYXQuc2VsZWN0aW9uQ29udHJvbGxlci5zZWxlY3ROb2RlKG5vZGUsIHRyeU11bHRpLCBzdXBwcmVzc0V2ZW50cyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkZXNlbGVjdE5vZGU6IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhhdC5zZWxlY3Rpb25Db250cm9sbGVyLmRlc2VsZWN0Tm9kZShub2RlKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNlbGVjdEFsbDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoYXQuc2VsZWN0aW9uQ29udHJvbGxlci5zZWxlY3RBbGwoKTtcclxuICAgICAgICAgICAgdGhhdC5yb3dSZW5kZXJlci5yZWZyZXNoVmlldygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZGVzZWxlY3RBbGw6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGF0LnNlbGVjdGlvbkNvbnRyb2xsZXIuZGVzZWxlY3RBbGwoKTtcclxuICAgICAgICAgICAgdGhhdC5yb3dSZW5kZXJlci5yZWZyZXNoVmlldygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVjb21wdXRlQWdncmVnYXRlczogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoYXQuaW5NZW1vcnlSb3dDb250cm9sbGVyLmRvQWdncmVnYXRlKCk7XHJcbiAgICAgICAgICAgIHRoYXQucm93UmVuZGVyZXIucmVmcmVzaEdyb3VwUm93cygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc2l6ZUNvbHVtbnNUb0ZpdDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciBhdmFpbGFibGVXaWR0aCA9IHRoYXQuZUJvZHkuY2xpZW50V2lkdGg7XHJcbiAgICAgICAgICAgIHZhciBzY3JvbGxTaG93aW5nID0gdGhhdC5lQm9keVZpZXdwb3J0LmNsaWVudEhlaWdodCA8IHRoYXQuZUJvZHlWaWV3cG9ydC5zY3JvbGxIZWlnaHQ7XHJcbiAgICAgICAgICAgIGlmIChzY3JvbGxTaG93aW5nKSB7XHJcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVXaWR0aCAtPSB0aGF0LnNjcm9sbFdpZHRoO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoYXQuY29sdW1uQ29udHJvbGxlci5zaXplQ29sdW1uc1RvRml0KGF2YWlsYWJsZVdpZHRoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNob3dMb2FkaW5nOiBmdW5jdGlvbihzaG93KSB7XHJcbiAgICAgICAgICAgIHRoYXQuc2hvd0xvYWRpbmdQYW5lbChzaG93KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzTm9kZVNlbGVjdGVkOiBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGF0LnNlbGVjdGlvbkNvbnRyb2xsZXIuaXNOb2RlU2VsZWN0ZWQobm9kZSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRTZWxlY3RlZE5vZGVzOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoYXQuc2VsZWN0aW9uQ29udHJvbGxlci5nZXRTZWxlY3RlZE5vZGVzKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRCZXN0Q29zdE5vZGVTZWxlY3Rpb246IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhhdC5zZWxlY3Rpb25Db250cm9sbGVyLmdldEJlc3RDb3N0Tm9kZVNlbGVjdGlvbigpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW5zdXJlSW5kZXhWaXNpYmxlOiBmdW5jdGlvbihpbmRleCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhhdC5lbnN1cmVJbmRleFZpc2libGUoaW5kZXgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZW5zdXJlTm9kZVZpc2libGU6IGZ1bmN0aW9uKGNvbXBhcmF0b3IpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoYXQuZW5zdXJlTm9kZVZpc2libGUoY29tcGFyYXRvcik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBleHBvcnREYXRhQXNDc3Y6IGZ1bmN0aW9uIChwYXJhbXMpIHtcclxuICAgICAgICAgIHJldHVybiB0aGF0LmV4cG9ydERhdGFBc0NzdihwYXJhbXMpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aGlzLmdyaWRPcHRpb25zLmFwaSA9IGFwaTtcclxufTtcclxuXHJcbkdyaWQucHJvdG90eXBlLmV4cG9ydERhdGFBc0NzdiA9IGZ1bmN0aW9uIChwYXJhbXMpIHtcclxuICB2YXIgY3N2U3RyaW5nID0gdGhpcy5nZXREYXRhQXNDc3YocGFyYW1zKTtcclxuICB2YXIgZmlsZU5hbWVQcmVzZW50ID0gcGFyYW1zICYmIHBhcmFtcy5maWxlTmFtZSAmJiBwYXJhbXMuZmlsZU5hbWUubGVuZ3RoICE9PSAwO1xyXG4gIHZhciBmaWxlTmFtZSA9IGZpbGVOYW1lUHJlc2VudCA/IHBhcmFtcy5maWxlTmFtZSA6ICdleHBvcnQuY3N2JztcclxuICB2YXIgYmxvYk9iamVjdCA9IG5ldyBCbG9iKFtjc3ZTdHJpbmddLCB7XHJcbiAgICB0eXBlOiAndGV4dC9jc3Y7Y2hhcnNldD11dGYtODsnXHJcbiAgfSk7XHJcbiAgLy8gSW50ZXJuZXQgRXhwbG9yZXJcclxuICBpZiAod2luZG93Lm5hdmlnYXRvci5tc1NhdmVPck9wZW5CbG9iKSB7XHJcbiAgICB3aW5kb3cubmF2aWdhdG9yLm1zU2F2ZU9yT3BlbkJsb2IoYmxvYk9iamVjdCwgZmlsZU5hbWUpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBDaHJvbWVcclxuICAgIHZhciBkb3dubG9hZExpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcclxuICAgIGRvd25sb2FkTGluay5ocmVmID0gKHdpbmRvdykuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iT2JqZWN0KTtcclxuICAgIGRvd25sb2FkTGluay5kb3dubG9hZCA9IGZpbGVOYW1lO1xyXG5cclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZG93bmxvYWRMaW5rKTtcclxuICAgIGRvd25sb2FkTGluay5jbGljaygpO1xyXG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkb3dubG9hZExpbmspO1xyXG4gIH1cclxufVxyXG5HcmlkLnByb3RvdHlwZS5nZXREYXRhQXNDc3YgPSBmdW5jdGlvbiAocGFyYW1zKSB7XHJcblxyXG4gIHZhciBMSU5FX1NFUEFSQVRPUiA9ICdcXHJcXG4nO1xyXG5cclxuICB2YXIgcmVzdWx0ID0gJyc7XHJcblxyXG4gIHZhciBza2lwR3JvdXBzID0gcGFyYW1zICYmIHBhcmFtcy5za2lwR3JvdXBzO1xyXG4gIHZhciBza2lwSGVhZGVyID0gcGFyYW1zICYmIHBhcmFtcy5za2lwSGVhZGVyO1xyXG4gIHZhciBza2lwRm9vdGVycyA9IHBhcmFtcyAmJiBwYXJhbXMuc2tpcEZvb3RlcnM7XHJcbiAgdmFyIGluY2x1ZGVDdXN0b21IZWFkZXIgPSBwYXJhbXMgJiYgcGFyYW1zLmN1c3RvbUhlYWRlcjtcclxuICB2YXIgaW5jbHVkZUN1c3RvbUZvb3RlciA9IHBhcmFtcyAmJiBwYXJhbXMuY3VzdG9tRm9vdGVyO1xyXG5cclxuICB2YXIgY29sdW1uc1RvRXhwb3J0ID0gdGhpcy5ncmlkT3B0aW9ucy5jb2x1bW5EZWZzO1xyXG5cclxuICBpZiAoIWNvbHVtbnNUb0V4cG9ydCB8fCBjb2x1bW5zVG9FeHBvcnQubGVuZ3RoID09PSAwKSB7XHJcbiAgICByZXR1cm4gJyc7XHJcbiAgfVxyXG5cclxuICBpZiAoaW5jbHVkZUN1c3RvbUhlYWRlcikge1xyXG4gICAgcmVzdWx0ICs9IHBhcmFtcy5jdXN0b21IZWFkZXI7XHJcbiAgfVxyXG5cclxuICAvLyBmaXJzdCBwYXNzLCBwdXQgaW4gdGhlIGhlYWRlciBuYW1lcyBvZiB0aGUgY29sc1xyXG4gIGlmICghc2tpcEhlYWRlcikge1xyXG4gICAgY29sdW1uc1RvRXhwb3J0LmZvckVhY2goZnVuY3Rpb24oY29sdW1uLCBpbmRleCkge1xyXG4gICAgICBjb25zb2xlLmxvZyhjb2x1bW4pO1xyXG4gICAgICB2YXIgbmFtZUZvckNvbCA9IGNvbHVtbi5ncm91cCA/IGNvbHVtbi5ncm91cCArICc6JyA6ICcnO1xyXG4gICAgICBuYW1lRm9yQ29sICs9IGNvbHVtbi5kaXNwbGF5TmFtZTtcclxuICAgICAgaWYgKG5hbWVGb3JDb2wgPT09IG51bGwgfHwgbmFtZUZvckNvbCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgbmFtZUZvckNvbCA9ICcnO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChpbmRleCAhPSAwKSB7XHJcbiAgICAgICAgcmVzdWx0ICs9ICc7JztcclxuICAgICAgfVxyXG4gICAgICByZXN1bHQgKz0gJ1wiJyArIHRoaXMuZXNjYXBlKG5hbWVGb3JDb2wpICsgJ1wiJztcclxuICAgIH0pO1xyXG4gICAgcmVzdWx0ICs9IExJTkVfU0VQQVJBVE9SO1xyXG4gIH1cclxuXHJcbiAgdGhpcy5pbk1lbW9yeVJvd0NvbnRyb2xsZXIucm93c0FmdGVyU29ydC5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgIGlmIChza2lwR3JvdXBzICYmIG5vZGUuZ3JvdXApIHsgcmV0dXJuOyB9XHJcbiAgICBpZiAoc2tpcEZvb3RlcnMgJiYgbm9kZS5mb290ZXIpIHsgcmV0dXJuOyB9XHJcblxyXG4gICAgY29sdW1uc1RvRXhwb3J0LmZvckVhY2goZnVuY3Rpb24oY29sdW1uLCBpbmRleCkgIHtcclxuXHJcbiAgICAgIHZhciB2YWx1ZUZvckNlbGw7XHJcbiAgICAgIHZhciBkYXRhID0gbm9kZS5kYXRhW2NvbHVtbi5maWVsZF07XHJcbiAgICAgIGlmIChub2RlLmdyb3VwICYmIGluZGV4ID09PSAwKSB7XHJcbiAgICAgICAgdmFsdWVGb3JDZWxsID0gdGhpcy5jcmVhdGVWYWx1ZUZvckdyb3VwTm9kZShub2RlKTtcclxuICAgICAgfSBlbHNlIGlmIChkYXRhKSB7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhjb2x1bW4pO1xyXG4gICAgICAgIGlmIChjb2x1bW4uZXhwb3J0UmVuZGVyZXIpIHtcclxuICAgICAgICAgIHZhciBkYXRhID0gbm9kZS5kYXRhW2NvbHVtbi5maWVsZF07XHJcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnaXMgYXJyYXknKTtcclxuICAgICAgICAgICAgdmFsdWVGb3JDZWxsID0gY29sdW1uLmV4cG9ydFJlbmRlcmVyKGRhdGEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdubyBhcnJheScgKyBub2RlLmRhdGEgKyAnY29sdW1uJyArIGNvbHVtbik7XHJcbiAgICAgICAgICAgIHZhbHVlRm9yQ2VsbCA9IGNvbHVtbi5leHBvcnRSZW5kZXJlcihkYXRhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGNvbnNvbGUubG9nKCd2YWx1ZTogJyArIHZhbHVlRm9yQ2VsbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgdmFsdWVGb3JDZWxsID0gbm9kZS5kYXRhID8gbm9kZS5kYXRhW2NvbHVtbi5maWVsZF0gOiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBpZiAodmFsdWVGb3JDZWxsID09PSBudWxsIHx8IHZhbHVlRm9yQ2VsbCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdmFsdWVGb3JDZWxsID0gJyc7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGluZGV4ICE9IDApIHtcclxuICAgICAgICByZXN1bHQgKz0gJzsnO1xyXG4gICAgICB9XHJcbiAgICAgIHJlc3VsdCArPSAnXCInICsgdGhpcy5lc2NhcGUodmFsdWVGb3JDZWxsKSArICdcIic7XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXN1bHQgKz0gTElORV9TRVBBUkFUT1I7XHJcbiAgfSk7XHJcblxyXG4gIGlmIChpbmNsdWRlQ3VzdG9tRm9vdGVyKSB7XHJcbiAgICByZXN1bHQgKz0gcGFyYW1zLmN1c3RvbUZvb3RlcjtcclxuICB9XHJcblxyXG4gIHJldHVybiByZXN1bHQ7XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5jcmVhdGVWYWx1ZUZvckdyb3VwTm9kZSA9IGZ1bmN0aW9uIChub2RlKSB7XHJcbiAgdmFyIGtleXMgPSBbbm9kZS5rZXldO1xyXG4gIHdoaWxlIChub2RlLnBhcmVudCkge1xyXG4gICAgbm9kZSA9IG5vZGUucGFyZW50O1xyXG4gICAga2V5cy5wdXNoKG5vZGUua2V5KTtcclxuICB9XHJcbiAgcmV0dXJuIGtleXMucmV2ZXJzZSgpLmpvaW4oJyAtPiAnKTtcclxufTtcclxuXHJcbi8vIHJlcGxhY2UgZWFjaCBcIiB3aXRoIFwiXCIgKGllIHR3byBzZXRzIG9mIGRvdWJsZSBxdW90ZXMgaXMgaG93IHRvIGRvIGRvdWJsZSBxdW90ZXMgaW4gY3N2KVxyXG5HcmlkLnByb3RvdHlwZS5lc2NhcGUgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmV0dXJuICcnO1xyXG4gIH1cclxuXHJcbiAgdmFyIHN0cmluZ1ZhbHVlO1xyXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICBzdHJpbmdWYWx1ZSA9IHZhbHVlO1xyXG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlLnRvU3RyaW5nID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICBzdHJpbmdWYWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIGNvbnNvbGUud2Fybigna25vd24gdmFsdWUgdHlwZSBkdXJpbmcgY3N2IGNvbnZlcnNpb24nKTtcclxuICAgIHN0cmluZ1ZhbHVlID0gJyc7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gc3RyaW5nVmFsdWUucmVwbGFjZSgvXCIvZywgXCJcXFwiXFxcIlwiKTtcclxufTtcclxuXHJcbkdyaWQucHJvdG90eXBlLmFkZFZpcnR1YWxSb3dMaXN0ZW5lciA9IGZ1bmN0aW9uKHJvd0luZGV4LCBjYWxsYmFjaykge1xyXG4gICAgaWYgKCF0aGlzLnZpcnR1YWxSb3dDYWxsYmFja3Nbcm93SW5kZXhdKSB7XHJcbiAgICAgICAgdGhpcy52aXJ0dWFsUm93Q2FsbGJhY2tzW3Jvd0luZGV4XSA9IFtdO1xyXG4gICAgfVxyXG4gICAgdGhpcy52aXJ0dWFsUm93Q2FsbGJhY2tzW3Jvd0luZGV4XS5wdXNoKGNhbGxiYWNrKTtcclxufTtcclxuXHJcbkdyaWQucHJvdG90eXBlLm9uVmlydHVhbFJvd1NlbGVjdGVkID0gZnVuY3Rpb24ocm93SW5kZXgsIHNlbGVjdGVkKSB7XHJcbiAgICAvLyBpbmZvcm0gdGhlIGNhbGxiYWNrcyBvZiB0aGUgZXZlbnRcclxuICAgIGlmICh0aGlzLnZpcnR1YWxSb3dDYWxsYmFja3Nbcm93SW5kZXhdKSB7XHJcbiAgICAgICAgdGhpcy52aXJ0dWFsUm93Q2FsbGJhY2tzW3Jvd0luZGV4XS5mb3JFYWNoKGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sucm93UmVtb3ZlZCA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sucm93U2VsZWN0ZWQoc2VsZWN0ZWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5vblZpcnR1YWxSb3dSZW1vdmVkID0gZnVuY3Rpb24ocm93SW5kZXgpIHtcclxuICAgIC8vIGluZm9ybSB0aGUgY2FsbGJhY2tzIG9mIHRoZSBldmVudFxyXG4gICAgaWYgKHRoaXMudmlydHVhbFJvd0NhbGxiYWNrc1tyb3dJbmRleF0pIHtcclxuICAgICAgICB0aGlzLnZpcnR1YWxSb3dDYWxsYmFja3Nbcm93SW5kZXhdLmZvckVhY2goZnVuY3Rpb24oY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjay5yb3dSZW1vdmVkID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5yb3dSZW1vdmVkKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIC8vIHJlbW92ZSB0aGUgY2FsbGJhY2tzXHJcbiAgICBkZWxldGUgdGhpcy52aXJ0dWFsUm93Q2FsbGJhY2tzW3Jvd0luZGV4XTtcclxufTtcclxuXHJcbkdyaWQucHJvdG90eXBlLm9uTmV3Q29scyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5zZXR1cENvbHVtbnMoKTtcclxuICAgIHRoaXMudXBkYXRlTW9kZWxBbmRSZWZyZXNoKGNvbnN0YW50cy5TVEVQX0VWRVJZVEhJTkcpO1xyXG59O1xyXG5cclxuR3JpZC5wcm90b3R5cGUuZmluZEFsbEVsZW1lbnRzID0gZnVuY3Rpb24oZUdyaWREaXYpIHtcclxuICAgIGlmICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0RvbnRVc2VTY3JvbGxzKCkpIHtcclxuICAgICAgICB0aGlzLmVSb290ID0gZUdyaWREaXYucXVlcnlTZWxlY3RvcihcIi5hZy1yb290XCIpO1xyXG4gICAgICAgIHRoaXMuZUhlYWRlckNvbnRhaW5lciA9IGVHcmlkRGl2LnF1ZXJ5U2VsZWN0b3IoXCIuYWctaGVhZGVyLWNvbnRhaW5lclwiKTtcclxuICAgICAgICB0aGlzLmVCb2R5Q29udGFpbmVyID0gZUdyaWREaXYucXVlcnlTZWxlY3RvcihcIi5hZy1ib2R5LWNvbnRhaW5lclwiKTtcclxuICAgICAgICB0aGlzLmVMb2FkaW5nUGFuZWwgPSBlR3JpZERpdi5xdWVyeVNlbGVjdG9yKCcuYWctbG9hZGluZy1wYW5lbCcpO1xyXG4gICAgICAgIC8vIGZvciBuby1zY3JvbGxzLCBhbGwgcm93cyBsaXZlIGluIHRoZSBib2R5IGNvbnRhaW5lclxyXG4gICAgICAgIHRoaXMuZVBhcmVudE9mUm93cyA9IHRoaXMuZUJvZHlDb250YWluZXI7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuZVJvb3QgPSBlR3JpZERpdi5xdWVyeVNlbGVjdG9yKFwiLmFnLXJvb3RcIik7XHJcbiAgICAgICAgdGhpcy5lQm9keSA9IGVHcmlkRGl2LnF1ZXJ5U2VsZWN0b3IoXCIuYWctYm9keVwiKTtcclxuICAgICAgICB0aGlzLmVCb2R5Q29udGFpbmVyID0gZUdyaWREaXYucXVlcnlTZWxlY3RvcihcIi5hZy1ib2R5LWNvbnRhaW5lclwiKTtcclxuICAgICAgICB0aGlzLmVCb2R5Vmlld3BvcnQgPSBlR3JpZERpdi5xdWVyeVNlbGVjdG9yKFwiLmFnLWJvZHktdmlld3BvcnRcIik7XHJcbiAgICAgICAgdGhpcy5lQm9keVZpZXdwb3J0V3JhcHBlciA9IGVHcmlkRGl2LnF1ZXJ5U2VsZWN0b3IoXCIuYWctYm9keS12aWV3cG9ydC13cmFwcGVyXCIpO1xyXG4gICAgICAgIHRoaXMuZVBpbm5lZENvbHNDb250YWluZXIgPSBlR3JpZERpdi5xdWVyeVNlbGVjdG9yKFwiLmFnLXBpbm5lZC1jb2xzLWNvbnRhaW5lclwiKTtcclxuICAgICAgICB0aGlzLmVQaW5uZWRDb2xzVmlld3BvcnQgPSBlR3JpZERpdi5xdWVyeVNlbGVjdG9yKFwiLmFnLXBpbm5lZC1jb2xzLXZpZXdwb3J0XCIpO1xyXG4gICAgICAgIHRoaXMuZVBpbm5lZEhlYWRlciA9IGVHcmlkRGl2LnF1ZXJ5U2VsZWN0b3IoXCIuYWctcGlubmVkLWhlYWRlclwiKTtcclxuICAgICAgICB0aGlzLmVIZWFkZXIgPSBlR3JpZERpdi5xdWVyeVNlbGVjdG9yKFwiLmFnLWhlYWRlclwiKTtcclxuICAgICAgICB0aGlzLmVIZWFkZXJDb250YWluZXIgPSBlR3JpZERpdi5xdWVyeVNlbGVjdG9yKFwiLmFnLWhlYWRlci1jb250YWluZXJcIik7XHJcbiAgICAgICAgdGhpcy5lTG9hZGluZ1BhbmVsID0gZUdyaWREaXYucXVlcnlTZWxlY3RvcignLmFnLWxvYWRpbmctcGFuZWwnKTtcclxuICAgICAgICAvLyBmb3Igc2Nyb2xscywgYWxsIHJvd3MgbGl2ZSBpbiBlQm9keSAoY29udGFpbmluZyBwaW5uZWQgYW5kIG5vcm1hbCBib2R5KVxyXG4gICAgICAgIHRoaXMuZVBhcmVudE9mUm93cyA9IHRoaXMuZUJvZHk7XHJcbiAgICAgICAgdGhpcy5lUGFnaW5nUGFuZWwgPSBlR3JpZERpdi5xdWVyeVNlbGVjdG9yKCcuYWctcGFnaW5nLXBhbmVsJyk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS5zaG93UGlubmVkQ29sQ29udGFpbmVyc0lmTmVlZGVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICAvLyBubyBuZWVkIHRvIGRvIHRoaXMgaWYgbm90IHVzaW5nIHNjcm9sbHNcclxuICAgIGlmICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0RvbnRVc2VTY3JvbGxzKCkpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHNob3dpbmdQaW5uZWRDb2xzID0gdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0UGlubmVkQ29sQ291bnQoKSA+IDA7XHJcblxyXG4gICAgLy9zb21lIGJyb3dzZXJzIGhhZCBsYXlvdXQgaXNzdWVzIHdpdGggdGhlIGJsYW5rIGRpdnMsIHNvIGlmIGJsYW5rLFxyXG4gICAgLy93ZSBkb24ndCBkaXNwbGF5IHRoZW1cclxuICAgIGlmIChzaG93aW5nUGlubmVkQ29scykge1xyXG4gICAgICAgIHRoaXMuZVBpbm5lZEhlYWRlci5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XHJcbiAgICAgICAgdGhpcy5lUGlubmVkQ29sc1ZpZXdwb3J0LnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5lUGlubmVkSGVhZGVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICAgICAgdGhpcy5lUGlubmVkQ29sc1ZpZXdwb3J0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICB9XHJcbn07XHJcblxyXG5HcmlkLnByb3RvdHlwZS51cGRhdGVCb2R5Q29udGFpbmVyV2lkdGhBZnRlckNvbFJlc2l6ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5yb3dSZW5kZXJlci5zZXRNYWluUm93V2lkdGhzKCk7XHJcbiAgICB0aGlzLnNldEJvZHlDb250YWluZXJXaWR0aCgpO1xyXG59O1xyXG5cclxuR3JpZC5wcm90b3R5cGUudXBkYXRlUGlubmVkQ29sQ29udGFpbmVyV2lkdGhBZnRlckNvbFJlc2l6ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5zZXRQaW5uZWRDb2xDb250YWluZXJXaWR0aCgpO1xyXG59O1xyXG5cclxuR3JpZC5wcm90b3R5cGUuc2V0UGlubmVkQ29sQ29udGFpbmVyV2lkdGggPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBwaW5uZWRDb2xXaWR0aCA9IHRoaXMuY29sdW1uTW9kZWwuZ2V0UGlubmVkQ29udGFpbmVyV2lkdGgoKSArIFwicHhcIjtcclxuICAgIHRoaXMuZVBpbm5lZENvbHNDb250YWluZXIuc3R5bGUud2lkdGggPSBwaW5uZWRDb2xXaWR0aDtcclxuICAgIHRoaXMuZUJvZHlWaWV3cG9ydFdyYXBwZXIuc3R5bGUubWFyZ2luTGVmdCA9IHBpbm5lZENvbFdpZHRoO1xyXG59O1xyXG5cclxuLy8gc2VlIGlmIGEgZ3JleSBib3ggaXMgbmVlZGVkIGF0IHRoZSBib3R0b20gb2YgdGhlIHBpbm5lZCBjb2xcclxuR3JpZC5wcm90b3R5cGUuc2V0UGlubmVkQ29sSGVpZ2h0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAvLyB2YXIgYm9keUhlaWdodCA9IHV0aWxzLnBpeGVsU3RyaW5nVG9OdW1iZXIodGhpcy5lQm9keS5zdHlsZS5oZWlnaHQpO1xyXG4gICAgdmFyIHNjcm9sbFNob3dpbmcgPSB0aGlzLmVCb2R5Vmlld3BvcnQuY2xpZW50V2lkdGggPCB0aGlzLmVCb2R5Vmlld3BvcnQuc2Nyb2xsV2lkdGg7XHJcbiAgICB2YXIgYm9keUhlaWdodCA9IHRoaXMuZUJvZHlWaWV3cG9ydC5vZmZzZXRIZWlnaHQ7XHJcbiAgICBpZiAoc2Nyb2xsU2hvd2luZykge1xyXG4gICAgICAgIHRoaXMuZVBpbm5lZENvbHNWaWV3cG9ydC5zdHlsZS5oZWlnaHQgPSAoYm9keUhlaWdodCAtIHRoaXMuc2Nyb2xsV2lkdGgpICsgXCJweFwiO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmVQaW5uZWRDb2xzVmlld3BvcnQuc3R5bGUuaGVpZ2h0ID0gYm9keUhlaWdodCArIFwicHhcIjtcclxuICAgIH1cclxuICAgIC8vIGFsc28gdGhlIGxvYWRpbmcgb3ZlcmxheSwgbmVlZHMgdG8gaGF2ZSBpdCdzIGhlaWdodCBhZGp1c3RlZFxyXG4gICAgdGhpcy5lTG9hZGluZ1BhbmVsLnN0eWxlLmhlaWdodCA9IGJvZHlIZWlnaHQgKyAncHgnO1xyXG59O1xyXG5cclxuR3JpZC5wcm90b3R5cGUuc2V0Qm9keVNpemUgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdmFyIGJvZHlIZWlnaHQgPSB0aGlzLmVCb2R5Vmlld3BvcnQub2Zmc2V0SGVpZ2h0O1xyXG4gICAgdmFyIHBhZ2luZ1Zpc2libGUgPSB0aGlzLmlzU2hvd1BhZ2luZ1BhbmVsKCk7XHJcblxyXG4gICAgaWYgKHRoaXMuYm9keUhlaWdodExhc3RUaW1lICE9IGJvZHlIZWlnaHQgfHwgdGhpcy5zaG93UGFnaW5nUGFuZWxWaXNpYmxlTGFzdFRpbWUgIT0gcGFnaW5nVmlzaWJsZSkge1xyXG4gICAgICAgIHRoaXMuYm9keUhlaWdodExhc3RUaW1lID0gYm9keUhlaWdodDtcclxuICAgICAgICB0aGlzLnNob3dQYWdpbmdQYW5lbFZpc2libGVMYXN0VGltZSA9IHBhZ2luZ1Zpc2libGU7XHJcblxyXG4gICAgICAgIHRoaXMuc2V0UGlubmVkQ29sSGVpZ2h0KCk7XHJcblxyXG4gICAgICAgIC8vb25seSBkcmF3IHZpcnR1YWwgcm93cyBpZiBkb25lIHNvcnQgJiBmaWx0ZXIgLSB0aGlzXHJcbiAgICAgICAgLy9tZWFucyB3ZSBkb24ndCBkcmF3IHJvd3MgaWYgdGFibGUgaXMgbm90IHlldCBpbml0aWFsaXNlZFxyXG4gICAgICAgIGlmICh0aGlzLnJvd01vZGVsLmdldFZpcnR1YWxSb3dDb3VudCgpID4gMCkge1xyXG4gICAgICAgICAgICB0aGlzLnJvd1JlbmRlcmVyLmRyYXdWaXJ0dWFsUm93cygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gc2hvdyBhbmQgcG9zaXRpb24gcGFnaW5nIHBhbmVsXHJcbiAgICAgICAgdGhpcy5zaG93QW5kUG9zaXRpb25QYWdpbmdQYW5lbCgpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5maW5pc2hlZCkge1xyXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIF90aGlzLnNldEJvZHlTaXplKCk7XHJcbiAgICAgICAgfSwgMjAwKTtcclxuICAgIH1cclxufTtcclxuXHJcbkdyaWQucHJvdG90eXBlLmFkZFNjcm9sbExpc3RlbmVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcblxyXG4gICAgdmFyIGxhc3RMZWZ0UG9zaXRpb24gPSAtMTtcclxuICAgIHZhciBsYXN0VG9wUG9zaXRpb24gPSAtMTtcclxuXHJcbiAgICB0aGlzLmVCb2R5Vmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgbmV3TGVmdFBvc2l0aW9uID0gdGhhdC5lQm9keVZpZXdwb3J0LnNjcm9sbExlZnQ7XHJcbiAgICAgICAgdmFyIG5ld1RvcFBvc2l0aW9uID0gdGhhdC5lQm9keVZpZXdwb3J0LnNjcm9sbFRvcDtcclxuXHJcbiAgICAgICAgaWYgKG5ld0xlZnRQb3NpdGlvbiAhPT0gbGFzdExlZnRQb3NpdGlvbikge1xyXG4gICAgICAgICAgICBsYXN0TGVmdFBvc2l0aW9uID0gbmV3TGVmdFBvc2l0aW9uO1xyXG4gICAgICAgICAgICB0aGF0LnNjcm9sbEhlYWRlcihuZXdMZWZ0UG9zaXRpb24pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKG5ld1RvcFBvc2l0aW9uICE9PSBsYXN0VG9wUG9zaXRpb24pIHtcclxuICAgICAgICAgICAgbGFzdFRvcFBvc2l0aW9uID0gbmV3VG9wUG9zaXRpb247XHJcbiAgICAgICAgICAgIHRoYXQuc2Nyb2xsUGlubmVkKG5ld1RvcFBvc2l0aW9uKTtcclxuICAgICAgICAgICAgdGhhdC5yb3dSZW5kZXJlci5kcmF3VmlydHVhbFJvd3MoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmVQaW5uZWRDb2xzVmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAvLyB0aGlzIG1lYW5zIHRoZSBwaW5uZWQgcGFuZWwgd2FzIG1vdmVkLCB3aGljaCBjYW4gb25seVxyXG4gICAgICAgIC8vIGhhcHBlbiB3aGVuIHRoZSB1c2VyIGlzIG5hdmlnYXRpbmcgaW4gdGhlIHBpbm5lZCBjb250YWluZXJcclxuICAgICAgICAvLyBhcyB0aGUgcGlubmVkIGNvbCBzaG91bGQgbmV2ZXIgc2Nyb2xsLiBzbyB3ZSByb2xsYmFja1xyXG4gICAgICAgIC8vIHRoZSBzY3JvbGwgb24gdGhlIHBpbm5lZC5cclxuICAgICAgICB0aGF0LmVQaW5uZWRDb2xzVmlld3BvcnQuc2Nyb2xsVG9wID0gMDtcclxuICAgIH0pO1xyXG5cclxufTtcclxuXHJcbkdyaWQucHJvdG90eXBlLnNjcm9sbEhlYWRlciA9IGZ1bmN0aW9uKGJvZHlMZWZ0UG9zaXRpb24pIHtcclxuICAgIC8vIHRoaXMuZUhlYWRlckNvbnRhaW5lci5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlM2QoJyArIC1ib2R5TGVmdFBvc2l0aW9uICsgXCJweCwwLDApXCI7XHJcbiAgICB0aGlzLmVIZWFkZXJDb250YWluZXIuc3R5bGUubGVmdCA9IC1ib2R5TGVmdFBvc2l0aW9uICsgXCJweFwiO1xyXG59O1xyXG5cclxuR3JpZC5wcm90b3R5cGUuc2Nyb2xsUGlubmVkID0gZnVuY3Rpb24oYm9keVRvcFBvc2l0aW9uKSB7XHJcbiAgICAvLyB0aGlzLmVQaW5uZWRDb2xzQ29udGFpbmVyLnN0eWxlLnRyYW5zZm9ybSA9ICd0cmFuc2xhdGUzZCgwLCcgKyAtYm9keVRvcFBvc2l0aW9uICsgXCJweCwwKVwiO1xyXG4gICAgdGhpcy5lUGlubmVkQ29sc0NvbnRhaW5lci5zdHlsZS50b3AgPSAtYm9keVRvcFBvc2l0aW9uICsgXCJweFwiO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkO1xyXG4iLCJ2YXIgREVGQVVMVF9ST1dfSEVJR0hUID0gMzA7XHJcblxyXG5mdW5jdGlvbiBHcmlkT3B0aW9uc1dyYXBwZXIoZ3JpZE9wdGlvbnMpIHtcclxuICAgIHRoaXMuZ3JpZE9wdGlvbnMgPSBncmlkT3B0aW9ucztcclxuICAgIHRoaXMuc2V0dXBEZWZhdWx0cygpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpc1RydWUodmFsdWUpIHtcclxuICAgIHJldHVybiB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gJ3RydWUnO1xyXG59XHJcblxyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmlzUm93U2VsZWN0aW9uID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmdyaWRPcHRpb25zLnJvd1NlbGVjdGlvbiA9PT0gXCJzaW5nbGVcIiB8fCB0aGlzLmdyaWRPcHRpb25zLnJvd1NlbGVjdGlvbiA9PT0gXCJtdWx0aXBsZVwiOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmlzUm93U2VsZWN0aW9uTXVsdGkgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZ3JpZE9wdGlvbnMucm93U2VsZWN0aW9uID09PSAnbXVsdGlwbGUnOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldENvbnRleHQgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZ3JpZE9wdGlvbnMuY29udGV4dDsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5pc1ZpcnR1YWxQYWdpbmcgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGlzVHJ1ZSh0aGlzLmdyaWRPcHRpb25zLnZpcnR1YWxQYWdpbmcpOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmlzUm93c0FscmVhZHlHcm91cGVkID0gZnVuY3Rpb24oKSB7IHJldHVybiBpc1RydWUodGhpcy5ncmlkT3B0aW9ucy5yb3dzQWxyZWFkeUdyb3VwZWQpOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmlzR3JvdXBTZWxlY3RzQ2hpbGRyZW4gPSBmdW5jdGlvbigpIHsgcmV0dXJuIGlzVHJ1ZSh0aGlzLmdyaWRPcHRpb25zLmdyb3VwU2VsZWN0c0NoaWxkcmVuKTsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5pc0dyb3VwSW5jbHVkZUZvb3RlciA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gaXNUcnVlKHRoaXMuZ3JpZE9wdGlvbnMuZ3JvdXBJbmNsdWRlRm9vdGVyKTsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5pc1N1cHByZXNzUm93Q2xpY2tTZWxlY3Rpb24gPSBmdW5jdGlvbigpIHsgcmV0dXJuIGlzVHJ1ZSh0aGlzLmdyaWRPcHRpb25zLnN1cHByZXNzUm93Q2xpY2tTZWxlY3Rpb24pOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmlzR3JvdXBIZWFkZXJzID0gZnVuY3Rpb24oKSB7IHJldHVybiBpc1RydWUodGhpcy5ncmlkT3B0aW9ucy5ncm91cEhlYWRlcnMpOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldEdyb3VwSW5uZXJSZW5kZXJlciA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5ncm91cElubmVyUmVuZGVyZXI7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuaXNEb250VXNlU2Nyb2xscyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gaXNUcnVlKHRoaXMuZ3JpZE9wdGlvbnMuZG9udFVzZVNjcm9sbHMpOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldFJvd1N0eWxlID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmdyaWRPcHRpb25zLnJvd1N0eWxlOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldFJvd0NsYXNzID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmdyaWRPcHRpb25zLnJvd0NsYXNzOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldEdyaWRPcHRpb25zID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmdyaWRPcHRpb25zOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldEhlYWRlckNlbGxSZW5kZXJlciA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5oZWFkZXJDZWxsUmVuZGVyZXI7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuZ2V0QXBpID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmdyaWRPcHRpb25zLmFwaTsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5pc0VuYWJsZVNvcnRpbmcgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZ3JpZE9wdGlvbnMuZW5hYmxlU29ydGluZzsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5pc0VuYWJsZUNvbFJlc2l6ZSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5lbmFibGVDb2xSZXNpemU7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuaXNFbmFibGVGaWx0ZXIgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZ3JpZE9wdGlvbnMuZW5hYmxlRmlsdGVyOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldENvbFdpZHRoID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmdyaWRPcHRpb25zLmNvbFdpZHRoOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldEdyb3VwRGVmYXVsdEV4cGFuZGVkID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmdyaWRPcHRpb25zLmdyb3VwRGVmYXVsdEV4cGFuZGVkOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldEdyb3VwS2V5cyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5ncm91cEtleXM7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuZ2V0R3JvdXBBZ2dGdW5jdGlvbiA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5ncm91cEFnZ0Z1bmN0aW9uOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldEFsbFJvd3MgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZ3JpZE9wdGlvbnMucm93RGF0YTsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5pc0dyb3VwVXNlRW50aXJlUm93ID0gZnVuY3Rpb24oKSB7IHJldHVybiBpc1RydWUodGhpcy5ncmlkT3B0aW9ucy5ncm91cFVzZUVudGlyZVJvdyk7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuaXNBbmd1bGFyQ29tcGlsZVJvd3MgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGlzVHJ1ZSh0aGlzLmdyaWRPcHRpb25zLmFuZ3VsYXJDb21waWxlUm93cyk7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuaXNBbmd1bGFyQ29tcGlsZUZpbHRlcnMgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGlzVHJ1ZSh0aGlzLmdyaWRPcHRpb25zLmFuZ3VsYXJDb21waWxlRmlsdGVycyk7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuaXNBbmd1bGFyQ29tcGlsZUhlYWRlcnMgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGlzVHJ1ZSh0aGlzLmdyaWRPcHRpb25zLmFuZ3VsYXJDb21waWxlSGVhZGVycyk7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuZ2V0Q29sdW1uRGVmcyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5jb2x1bW5EZWZzOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldFJvd0hlaWdodCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5yb3dIZWlnaHQ7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuZ2V0TW9kZWxVcGRhdGVkID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmdyaWRPcHRpb25zLm1vZGVsVXBkYXRlZDsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5nZXRDZWxsQ2xpY2tlZCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5jZWxsQ2xpY2tlZDsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5nZXRDZWxsRG91YmxlQ2xpY2tlZCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5jZWxsRG91YmxlQ2xpY2tlZDsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5nZXRDZWxsVmFsdWVDaGFuZ2VkID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmdyaWRPcHRpb25zLmNlbGxWYWx1ZUNoYW5nZWQ7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuZ2V0Um93U2VsZWN0ZWQgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZ3JpZE9wdGlvbnMucm93U2VsZWN0ZWQ7IH07XHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuZ2V0U2VsZWN0aW9uQ2hhbmdlZCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5zZWxlY3Rpb25DaGFuZ2VkOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldFZpcnR1YWxSb3dSZW1vdmVkID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmdyaWRPcHRpb25zLnZpcnR1YWxSb3dSZW1vdmVkOyB9O1xyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldERhdGFzb3VyY2UgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZ3JpZE9wdGlvbnMuZGF0YXNvdXJjZTsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5nZXRSZWFkeSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpcy5ncmlkT3B0aW9ucy5yZWFkeTsgfTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5nZXRSb3dCdWZmZXIgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZ3JpZE9wdGlvbnMucm93QnVmZmVyOyB9O1xyXG5cclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5zZXRTZWxlY3RlZFJvd3MgPSBmdW5jdGlvbihuZXdTZWxlY3RlZFJvd3MpIHtcclxuICAgIHJldHVybiB0aGlzLmdyaWRPcHRpb25zLnNlbGVjdGVkUm93cyA9IG5ld1NlbGVjdGVkUm93cztcclxufTtcclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5zZXRTZWxlY3RlZE5vZGVzQnlJZCA9IGZ1bmN0aW9uKG5ld1NlbGVjdGVkTm9kZXMpIHtcclxuICAgIHJldHVybiB0aGlzLmdyaWRPcHRpb25zLnNlbGVjdGVkTm9kZXNCeUlkID0gbmV3U2VsZWN0ZWROb2RlcztcclxufTtcclxuXHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuZ2V0SWNvbnMgPSBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmdyaWRPcHRpb25zLmljb25zO1xyXG59O1xyXG5cclxuR3JpZE9wdGlvbnNXcmFwcGVyLnByb3RvdHlwZS5pc0RvSW50ZXJuYWxHcm91cGluZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuICF0aGlzLmlzUm93c0FscmVhZHlHcm91cGVkKCkgJiYgdGhpcy5ncmlkT3B0aW9ucy5ncm91cEtleXM7XHJcbn07XHJcblxyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLmdldEhlYWRlckhlaWdodCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYgKHR5cGVvZiB0aGlzLmdyaWRPcHRpb25zLmhlYWRlckhlaWdodCA9PT0gJ251bWJlcicpIHtcclxuICAgICAgICAvLyBpZiBoZWFkZXIgaGVpZ2h0IHByb3ZpZGVkLCB1c2VkIGl0XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZ3JpZE9wdGlvbnMuaGVhZGVySGVpZ2h0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBvdGhlcndpc2UgcmV0dXJuIDI1IGlmIG5vIGdyb3VwaW5nLCA1MCBpZiBncm91cGluZ1xyXG4gICAgICAgIGlmICh0aGlzLmlzR3JvdXBIZWFkZXJzKCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIDUwO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiAyNTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcblxyXG5HcmlkT3B0aW9uc1dyYXBwZXIucHJvdG90eXBlLnNldHVwRGVmYXVsdHMgPSBmdW5jdGlvbigpIHtcclxuICAgIGlmICghdGhpcy5ncmlkT3B0aW9ucy5yb3dIZWlnaHQpIHtcclxuICAgICAgICB0aGlzLmdyaWRPcHRpb25zLnJvd0hlaWdodCA9IERFRkFVTFRfUk9XX0hFSUdIVDtcclxuICAgIH1cclxufTtcclxuXHJcbkdyaWRPcHRpb25zV3JhcHBlci5wcm90b3R5cGUuZ2V0UGlubmVkQ29sQ291bnQgPSBmdW5jdGlvbigpIHtcclxuICAgIC8vIGlmIG5vdCB1c2luZyBzY3JvbGxzLCB0aGVuIHBpbm5lZCBjb2x1bW5zIGRvZXNuJ3QgbWFrZVxyXG4gICAgLy8gc2Vuc2UsIHNvIGFsd2F5cyByZXR1cm4gMFxyXG4gICAgaWYgKHRoaXMuaXNEb250VXNlU2Nyb2xscygpKSB7XHJcbiAgICAgICAgcmV0dXJuIDA7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5ncmlkT3B0aW9ucy5waW5uZWRDb2x1bW5Db3VudCkge1xyXG4gICAgICAgIC8vaW4gY2FzZSB1c2VyIHB1dHMgaW4gYSBzdHJpbmcsIGNhc3QgdG8gbnVtYmVyXHJcbiAgICAgICAgcmV0dXJuIE51bWJlcih0aGlzLmdyaWRPcHRpb25zLnBpbm5lZENvbHVtbkNvdW50KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIDA7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWRPcHRpb25zV3JhcHBlcjtcclxuIiwiZnVuY3Rpb24gR3JvdXBDcmVhdG9yKCkge31cclxuXHJcbkdyb3VwQ3JlYXRvci5wcm90b3R5cGUuZ3JvdXAgPSBmdW5jdGlvbihyb3dOb2RlcywgZ3JvdXBCeUZpZWxkcywgZ3JvdXBBZ2dGdW5jdGlvbiwgZXhwYW5kQnlEZWZhdWx0KSB7XHJcblxyXG4gICAgdmFyIHRvcE1vc3RHcm91cCA9IHtcclxuICAgICAgICBsZXZlbDogLTEsXHJcbiAgICAgICAgY2hpbGRyZW46IFtdLFxyXG4gICAgICAgIGNoaWxkcmVuTWFwOiB7fVxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgYWxsR3JvdXBzID0gW107XHJcbiAgICBhbGxHcm91cHMucHVzaCh0b3BNb3N0R3JvdXApO1xyXG5cclxuICAgIHZhciBsZXZlbFRvSW5zZXJ0Q2hpbGQgPSBncm91cEJ5RmllbGRzLmxlbmd0aCAtIDE7XHJcbiAgICB2YXIgaSwgY3VycmVudExldmVsLCBub2RlLCBkYXRhLCBjdXJyZW50R3JvdXAsIGdyb3VwQnlGaWVsZCwgZ3JvdXBLZXksIG5leHRHcm91cDtcclxuXHJcbiAgICAvLyBzdGFydCBhdCAtMSBhbmQgZ28gYmFja3dhcmRzLCBhcyBhbGwgdGhlIHBvc2l0aXZlIGluZGV4ZXNcclxuICAgIC8vIGFyZSBhbHJlYWR5IHVzZWQgYnkgdGhlIG5vZGVzLlxyXG4gICAgdmFyIGluZGV4ID0gLTE7XHJcblxyXG4gICAgZm9yIChpID0gMDsgaSA8IHJvd05vZGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgbm9kZSA9IHJvd05vZGVzW2ldO1xyXG4gICAgICAgIGRhdGEgPSBub2RlLmRhdGE7XHJcblxyXG4gICAgICAgIC8vIGFsbCBsZWFmIG5vZGVzIGhhdmUgdGhlIHNhbWUgbGV2ZWwgaW4gdGhpcyBncm91cGluZywgd2hpY2ggaXMgb25lIGxldmVsIGFmdGVyIHRoZSBsYXN0IGdyb3VwXHJcbiAgICAgICAgbm9kZS5sZXZlbCA9IGxldmVsVG9JbnNlcnRDaGlsZCArIDE7XHJcblxyXG4gICAgICAgIGZvciAoY3VycmVudExldmVsID0gMDsgY3VycmVudExldmVsIDwgZ3JvdXBCeUZpZWxkcy5sZW5ndGg7IGN1cnJlbnRMZXZlbCsrKSB7XHJcbiAgICAgICAgICAgIGdyb3VwQnlGaWVsZCA9IGdyb3VwQnlGaWVsZHNbY3VycmVudExldmVsXTtcclxuICAgICAgICAgICAgZ3JvdXBLZXkgPSBkYXRhW2dyb3VwQnlGaWVsZF07XHJcblxyXG4gICAgICAgICAgICBpZiAoY3VycmVudExldmVsID09IDApIHtcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRHcm91cCA9IHRvcE1vc3RHcm91cDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gaWYgZ3JvdXAgZG9lc24ndCBleGlzdCB5ZXQsIGNyZWF0ZSBpdFxyXG4gICAgICAgICAgICBuZXh0R3JvdXAgPSBjdXJyZW50R3JvdXAuY2hpbGRyZW5NYXBbZ3JvdXBLZXldO1xyXG4gICAgICAgICAgICBpZiAoIW5leHRHcm91cCkge1xyXG4gICAgICAgICAgICAgICAgbmV4dEdyb3VwID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGdyb3VwOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkOiBncm91cEJ5RmllbGQsXHJcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGluZGV4LS0sXHJcbiAgICAgICAgICAgICAgICAgICAga2V5OiBncm91cEtleSxcclxuICAgICAgICAgICAgICAgICAgICBleHBhbmRlZDogdGhpcy5pc0V4cGFuZGVkKGV4cGFuZEJ5RGVmYXVsdCwgY3VycmVudExldmVsKSxcclxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gZm9yIHRvcCBtb3N0IGxldmVsLCBwYXJlbnQgaXMgbnVsbFxyXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogY3VycmVudEdyb3VwID09PSB0b3BNb3N0R3JvdXAgPyBudWxsIDogY3VycmVudEdyb3VwLFxyXG4gICAgICAgICAgICAgICAgICAgIGFsbENoaWxkcmVuQ291bnQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgbGV2ZWw6IGN1cnJlbnRHcm91cC5sZXZlbCArIDEsXHJcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW5NYXA6IHt9IC8vdGhpcyBpcyBhIHRlbXBvcmFyeSBtYXAsIHdlIHJlbW92ZSBhdCB0aGUgZW5kIG9mIHRoaXMgbWV0aG9kXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgY3VycmVudEdyb3VwLmNoaWxkcmVuTWFwW2dyb3VwS2V5XSA9IG5leHRHcm91cDtcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRHcm91cC5jaGlsZHJlbi5wdXNoKG5leHRHcm91cCk7XHJcbiAgICAgICAgICAgICAgICBhbGxHcm91cHMucHVzaChuZXh0R3JvdXApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBuZXh0R3JvdXAuYWxsQ2hpbGRyZW5Db3VudCsrO1xyXG5cclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRMZXZlbCA9PSBsZXZlbFRvSW5zZXJ0Q2hpbGQpIHtcclxuICAgICAgICAgICAgICAgIG5vZGUucGFyZW50ID0gbmV4dEdyb3VwID09PSB0b3BNb3N0R3JvdXAgPyBudWxsIDogbmV4dEdyb3VwO1xyXG4gICAgICAgICAgICAgICAgbmV4dEdyb3VwLmNoaWxkcmVuLnB1c2gobm9kZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjdXJyZW50R3JvdXAgPSBuZXh0R3JvdXA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8vcmVtb3ZlIHRoZSB0ZW1wb3JhcnkgbWFwXHJcbiAgICBmb3IgKGkgPSAwOyBpIDwgYWxsR3JvdXBzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgZGVsZXRlIGFsbEdyb3Vwc1tpXS5jaGlsZHJlbk1hcDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdG9wTW9zdEdyb3VwLmNoaWxkcmVuO1xyXG59O1xyXG5cclxuR3JvdXBDcmVhdG9yLnByb3RvdHlwZS5pc0V4cGFuZGVkID0gZnVuY3Rpb24oZXhwYW5kQnlEZWZhdWx0LCBsZXZlbCkge1xyXG4gICAgaWYgKHR5cGVvZiBleHBhbmRCeURlZmF1bHQgPT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgcmV0dXJuIGxldmVsIDwgZXhwYW5kQnlEZWZhdWx0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gZXhwYW5kQnlEZWZhdWx0ID09PSB0cnVlIHx8IGV4cGFuZEJ5RGVmYXVsdCA9PT0gJ3RydWUnO1xyXG4gICAgfVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBuZXcgR3JvdXBDcmVhdG9yKCk7XHJcbiIsInZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcclxudmFyIFN2Z0ZhY3RvcnkgPSByZXF1aXJlKCcuL3N2Z0ZhY3RvcnknKTtcclxudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4vY29uc3RhbnRzJyk7XHJcblxyXG52YXIgc3ZnRmFjdG9yeSA9IG5ldyBTdmdGYWN0b3J5KCk7XHJcblxyXG5mdW5jdGlvbiBIZWFkZXJSZW5kZXJlcigpIHt9XHJcblxyXG5IZWFkZXJSZW5kZXJlci5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKGdyaWRPcHRpb25zV3JhcHBlciwgY29sdW1uQ29udHJvbGxlciwgY29sdW1uTW9kZWwsIGVHcmlkLCBhbmd1bGFyR3JpZCwgZmlsdGVyTWFuYWdlciwgJHNjb3BlLCAkY29tcGlsZSkge1xyXG4gICAgdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIgPSBncmlkT3B0aW9uc1dyYXBwZXI7XHJcbiAgICB0aGlzLmNvbHVtbk1vZGVsID0gY29sdW1uTW9kZWw7XHJcbiAgICB0aGlzLmNvbHVtbkNvbnRyb2xsZXIgPSBjb2x1bW5Db250cm9sbGVyO1xyXG4gICAgdGhpcy5hbmd1bGFyR3JpZCA9IGFuZ3VsYXJHcmlkO1xyXG4gICAgdGhpcy5maWx0ZXJNYW5hZ2VyID0gZmlsdGVyTWFuYWdlcjtcclxuICAgIHRoaXMuJHNjb3BlID0gJHNjb3BlO1xyXG4gICAgdGhpcy4kY29tcGlsZSA9ICRjb21waWxlO1xyXG4gICAgdGhpcy5maW5kQWxsRWxlbWVudHMoZUdyaWQpO1xyXG59O1xyXG5cclxuSGVhZGVyUmVuZGVyZXIucHJvdG90eXBlLmZpbmRBbGxFbGVtZW50cyA9IGZ1bmN0aW9uKGVHcmlkKSB7XHJcblxyXG4gICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzRG9udFVzZVNjcm9sbHMoKSkge1xyXG4gICAgICAgIHRoaXMuZUhlYWRlckNvbnRhaW5lciA9IGVHcmlkLnF1ZXJ5U2VsZWN0b3IoXCIuYWctaGVhZGVyLWNvbnRhaW5lclwiKTtcclxuICAgICAgICB0aGlzLmVSb290ID0gZUdyaWQucXVlcnlTZWxlY3RvcihcIi5hZy1yb290XCIpO1xyXG4gICAgICAgIC8vIGZvciBuby1zY3JvbGwsIGFsbCBoZWFkZXIgY2VsbHMgbGl2ZSBpbiB0aGUgaGVhZGVyIGNvbnRhaW5lciAodGhlIGFnLWhlYWRlciBkb2Vzbid0IGV4aXN0KVxyXG4gICAgICAgIHRoaXMuZUhlYWRlclBhcmVudCA9IHRoaXMuZUhlYWRlckNvbnRhaW5lcjtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5lUGlubmVkSGVhZGVyID0gZUdyaWQucXVlcnlTZWxlY3RvcihcIi5hZy1waW5uZWQtaGVhZGVyXCIpO1xyXG4gICAgICAgIHRoaXMuZUhlYWRlckNvbnRhaW5lciA9IGVHcmlkLnF1ZXJ5U2VsZWN0b3IoXCIuYWctaGVhZGVyLWNvbnRhaW5lclwiKTtcclxuICAgICAgICB0aGlzLmVIZWFkZXIgPSBlR3JpZC5xdWVyeVNlbGVjdG9yKFwiLmFnLWhlYWRlclwiKTtcclxuICAgICAgICB0aGlzLmVSb290ID0gZUdyaWQucXVlcnlTZWxlY3RvcihcIi5hZy1yb290XCIpO1xyXG4gICAgICAgIC8vIGZvciBzY3JvbGwsIGFsbCBoZWFkZXIgY2VsbHMgbGl2ZSBpbiB0aGUgaGVhZGVyIChjb250YWlucyBib3RoIG5vcm1hbCBhbmQgcGlubmVkIGhlYWRlcnMpXHJcbiAgICAgICAgdGhpcy5lSGVhZGVyUGFyZW50ID0gdGhpcy5lSGVhZGVyO1xyXG4gICAgfVxyXG59O1xyXG5cclxuSGVhZGVyUmVuZGVyZXIucHJvdG90eXBlLnJlZnJlc2hIZWFkZXIgPSBmdW5jdGlvbigpIHtcclxuICAgIHV0aWxzLnJlbW92ZUFsbENoaWxkcmVuKHRoaXMuZVBpbm5lZEhlYWRlcik7XHJcbiAgICB1dGlscy5yZW1vdmVBbGxDaGlsZHJlbih0aGlzLmVIZWFkZXJDb250YWluZXIpO1xyXG5cclxuICAgIGlmICh0aGlzLmNoaWxkU2NvcGVzKSB7XHJcbiAgICAgICAgdGhpcy5jaGlsZFNjb3Blcy5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkU2NvcGUpIHtcclxuICAgICAgICAgICAgY2hpbGRTY29wZS4kZGVzdHJveSgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jaGlsZFNjb3BlcyA9IFtdO1xyXG5cclxuICAgIGlmICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0dyb3VwSGVhZGVycygpKSB7XHJcbiAgICAgICAgdGhpcy5pbnNlcnRIZWFkZXJzV2l0aEdyb3VwaW5nKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuaW5zZXJ0SGVhZGVyc1dpdGhvdXRHcm91cGluZygpO1xyXG4gICAgfVxyXG5cclxufTtcclxuXHJcbkhlYWRlclJlbmRlcmVyLnByb3RvdHlwZS5pbnNlcnRIZWFkZXJzV2l0aEdyb3VwaW5nID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgZ3JvdXBzID0gdGhpcy5jb2x1bW5Nb2RlbC5nZXRDb2x1bW5Hcm91cHMoKTtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIGdyb3Vwcy5mb3JFYWNoKGZ1bmN0aW9uKGdyb3VwKSB7XHJcbiAgICAgICAgdmFyIGVIZWFkZXJDZWxsID0gdGhhdC5jcmVhdGVHcm91cGVkSGVhZGVyQ2VsbChncm91cCk7XHJcbiAgICAgICAgdmFyIGVDb250YWluZXJUb0FkZFRvID0gZ3JvdXAucGlubmVkID8gdGhhdC5lUGlubmVkSGVhZGVyIDogdGhhdC5lSGVhZGVyQ29udGFpbmVyO1xyXG4gICAgICAgIGVDb250YWluZXJUb0FkZFRvLmFwcGVuZENoaWxkKGVIZWFkZXJDZWxsKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxuSGVhZGVyUmVuZGVyZXIucHJvdG90eXBlLmNyZWF0ZUdyb3VwZWRIZWFkZXJDZWxsID0gZnVuY3Rpb24oZ3JvdXApIHtcclxuXHJcbiAgICB2YXIgZUhlYWRlckdyb3VwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICBlSGVhZGVyR3JvdXAuY2xhc3NOYW1lID0gJ2FnLWhlYWRlci1ncm91cCc7XHJcblxyXG4gICAgdmFyIGVIZWFkZXJHcm91cENlbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgIGdyb3VwLmVIZWFkZXJHcm91cENlbGwgPSBlSGVhZGVyR3JvdXBDZWxsO1xyXG4gICAgdmFyIGNsYXNzTmFtZXMgPSBbJ2FnLWhlYWRlci1ncm91cC1jZWxsJ107XHJcbiAgICAvLyBoYXZpbmcgZGlmZmVyZW50IGNsYXNzZXMgYmVsb3cgYWxsb3dzIHRoZSBzdHlsZSB0byBub3QgaGF2ZSBhIGJvdHRvbSBib3JkZXJcclxuICAgIC8vIG9uIHRoZSBncm91cCBoZWFkZXIsIGlmIG5vIGdyb3VwIGlzIHNwZWNpZmllZFxyXG4gICAgaWYgKGdyb3VwLm5hbWUpIHtcclxuICAgICAgICBjbGFzc05hbWVzLnB1c2goJ2FnLWhlYWRlci1ncm91cC1jZWxsLXdpdGgtZ3JvdXAnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY2xhc3NOYW1lcy5wdXNoKCdhZy1oZWFkZXItZ3JvdXAtY2VsbC1uby1ncm91cCcpO1xyXG4gICAgfVxyXG4gICAgZUhlYWRlckdyb3VwQ2VsbC5jbGFzc05hbWUgPSBjbGFzc05hbWVzLmpvaW4oJyAnKTtcclxuXHJcbiAgICBpZiAodGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNFbmFibGVDb2xSZXNpemUoKSkge1xyXG4gICAgICAgIHZhciBlSGVhZGVyQ2VsbFJlc2l6ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgZUhlYWRlckNlbGxSZXNpemUuY2xhc3NOYW1lID0gXCJhZy1oZWFkZXItY2VsbC1yZXNpemVcIjtcclxuICAgICAgICBlSGVhZGVyR3JvdXBDZWxsLmFwcGVuZENoaWxkKGVIZWFkZXJDZWxsUmVzaXplKTtcclxuICAgICAgICBncm91cC5lSGVhZGVyQ2VsbFJlc2l6ZSA9IGVIZWFkZXJDZWxsUmVzaXplO1xyXG4gICAgICAgIHZhciBkcmFnQ2FsbGJhY2sgPSB0aGlzLmdyb3VwRHJhZ0NhbGxiYWNrRmFjdG9yeShncm91cCk7XHJcbiAgICAgICAgdGhpcy5hZGREcmFnSGFuZGxlcihlSGVhZGVyQ2VsbFJlc2l6ZSwgZHJhZ0NhbGxiYWNrKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBubyByZW5kZXJlciwgZGVmYXVsdCB0ZXh0IHJlbmRlclxyXG4gICAgdmFyIGdyb3VwTmFtZSA9IGdyb3VwLm5hbWU7XHJcbiAgICBpZiAoZ3JvdXBOYW1lICYmIGdyb3VwTmFtZSAhPT0gJycpIHtcclxuICAgICAgICB2YXIgZUdyb3VwQ2VsbExhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICBlR3JvdXBDZWxsTGFiZWwuY2xhc3NOYW1lID0gJ2FnLWhlYWRlci1ncm91cC1jZWxsLWxhYmVsJztcclxuICAgICAgICBlSGVhZGVyR3JvdXBDZWxsLmFwcGVuZENoaWxkKGVHcm91cENlbGxMYWJlbCk7XHJcblxyXG4gICAgICAgIHZhciBlSW5uZXJUZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XHJcbiAgICAgICAgZUlubmVyVGV4dC5jbGFzc05hbWUgPSAnYWctaGVhZGVyLWdyb3VwLXRleHQnO1xyXG4gICAgICAgIGVJbm5lclRleHQuaW5uZXJIVE1MID0gZ3JvdXBOYW1lO1xyXG4gICAgICAgIGVHcm91cENlbGxMYWJlbC5hcHBlbmRDaGlsZChlSW5uZXJUZXh0KTtcclxuXHJcbiAgICAgICAgaWYgKGdyb3VwLmV4cGFuZGFibGUpIHtcclxuICAgICAgICAgICAgdGhpcy5hZGRHcm91cEV4cGFuZEljb24oZ3JvdXAsIGVHcm91cENlbGxMYWJlbCwgZ3JvdXAuZXhwYW5kZWQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGVIZWFkZXJHcm91cC5hcHBlbmRDaGlsZChlSGVhZGVyR3JvdXBDZWxsKTtcclxuXHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICBncm91cC52aXNpYmxlQ29sdW1ucy5mb3JFYWNoKGZ1bmN0aW9uKGNvbHVtbikge1xyXG4gICAgICAgIHZhciBlSGVhZGVyQ2VsbCA9IHRoYXQuY3JlYXRlSGVhZGVyQ2VsbChjb2x1bW4sIHRydWUsIGdyb3VwKTtcclxuICAgICAgICBlSGVhZGVyR3JvdXAuYXBwZW5kQ2hpbGQoZUhlYWRlckNlbGwpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhhdC5zZXRXaWR0aE9mR3JvdXBIZWFkZXJDZWxsKGdyb3VwKTtcclxuXHJcbiAgICByZXR1cm4gZUhlYWRlckdyb3VwO1xyXG59O1xyXG5cclxuSGVhZGVyUmVuZGVyZXIucHJvdG90eXBlLmFkZEdyb3VwRXhwYW5kSWNvbiA9IGZ1bmN0aW9uKGdyb3VwLCBlSGVhZGVyR3JvdXAsIGV4cGFuZGVkKSB7XHJcbiAgICB2YXIgZUdyb3VwSWNvbjtcclxuICAgIGlmIChleHBhbmRlZCkge1xyXG4gICAgICAgIGVHcm91cEljb24gPSB1dGlscy5jcmVhdGVJY29uKCdjb2x1bW5Hcm91cE9wZW5lZCcsIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLCBudWxsLCBzdmdGYWN0b3J5LmNyZWF0ZUFycm93TGVmdFN2Zyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGVHcm91cEljb24gPSB1dGlscy5jcmVhdGVJY29uKCdjb2x1bW5Hcm91cENsb3NlZCcsIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLCBudWxsLCBzdmdGYWN0b3J5LmNyZWF0ZUFycm93UmlnaHRTdmcpO1xyXG4gICAgfVxyXG4gICAgZUdyb3VwSWNvbi5jbGFzc05hbWUgPSAnYWctaGVhZGVyLWV4cGFuZC1pY29uJztcclxuICAgIGVIZWFkZXJHcm91cC5hcHBlbmRDaGlsZChlR3JvdXBJY29uKTtcclxuXHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICBlR3JvdXBJY29uLm9uY2xpY2sgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGF0LmNvbHVtbkNvbnRyb2xsZXIuY29sdW1uR3JvdXBPcGVuZWQoZ3JvdXApO1xyXG4gICAgfTtcclxufTtcclxuXHJcbkhlYWRlclJlbmRlcmVyLnByb3RvdHlwZS5hZGREcmFnSGFuZGxlciA9IGZ1bmN0aW9uKGVEcmFnZ2FibGVFbGVtZW50LCBkcmFnQ2FsbGJhY2spIHtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIGVEcmFnZ2FibGVFbGVtZW50Lm9ubW91c2Vkb3duID0gZnVuY3Rpb24oZG93bkV2ZW50KSB7XHJcbiAgICAgICAgZHJhZ0NhbGxiYWNrLm9uRHJhZ1N0YXJ0KCk7XHJcbiAgICAgICAgdGhhdC5lUm9vdC5zdHlsZS5jdXJzb3IgPSBcImNvbC1yZXNpemVcIjtcclxuICAgICAgICB0aGF0LmRyYWdTdGFydFggPSBkb3duRXZlbnQuY2xpZW50WDtcclxuXHJcbiAgICAgICAgdGhhdC5lUm9vdC5vbm1vdXNlbW92ZSA9IGZ1bmN0aW9uKG1vdmVFdmVudCkge1xyXG4gICAgICAgICAgICB2YXIgbmV3WCA9IG1vdmVFdmVudC5jbGllbnRYO1xyXG4gICAgICAgICAgICB2YXIgY2hhbmdlID0gbmV3WCAtIHRoYXQuZHJhZ1N0YXJ0WDtcclxuICAgICAgICAgICAgZHJhZ0NhbGxiYWNrLm9uRHJhZ2dpbmcoY2hhbmdlKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoYXQuZVJvb3Qub25tb3VzZXVwID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoYXQuc3RvcERyYWdnaW5nKCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICB0aGF0LmVSb290Lm9ubW91c2VsZWF2ZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGF0LnN0b3BEcmFnZ2luZygpO1xyXG4gICAgICAgIH07XHJcbiAgICB9O1xyXG59O1xyXG5cclxuSGVhZGVyUmVuZGVyZXIucHJvdG90eXBlLnNldFdpZHRoT2ZHcm91cEhlYWRlckNlbGwgPSBmdW5jdGlvbihoZWFkZXJHcm91cCkge1xyXG4gICAgdmFyIHRvdGFsV2lkdGggPSAwO1xyXG4gICAgaGVhZGVyR3JvdXAudmlzaWJsZUNvbHVtbnMuZm9yRWFjaChmdW5jdGlvbihjb2x1bW4pIHtcclxuICAgICAgICB0b3RhbFdpZHRoICs9IGNvbHVtbi5hY3R1YWxXaWR0aDtcclxuICAgIH0pO1xyXG4gICAgaGVhZGVyR3JvdXAuZUhlYWRlckdyb3VwQ2VsbC5zdHlsZS53aWR0aCA9IHV0aWxzLmZvcm1hdFdpZHRoKHRvdGFsV2lkdGgpO1xyXG4gICAgaGVhZGVyR3JvdXAuYWN0dWFsV2lkdGggPSB0b3RhbFdpZHRoO1xyXG59O1xyXG5cclxuSGVhZGVyUmVuZGVyZXIucHJvdG90eXBlLmluc2VydEhlYWRlcnNXaXRob3V0R3JvdXBpbmcgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBlUGlubmVkSGVhZGVyID0gdGhpcy5lUGlubmVkSGVhZGVyO1xyXG4gICAgdmFyIGVIZWFkZXJDb250YWluZXIgPSB0aGlzLmVIZWFkZXJDb250YWluZXI7XHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy5jb2x1bW5Nb2RlbC5nZXRWaXNpYmxlQ29sdW1ucygpLmZvckVhY2goZnVuY3Rpb24oY29sdW1uKSB7XHJcbiAgICAgICAgLy8gb25seSBpbmNsdWRlIHRoZSBmaXJzdCB4IGNvbHNcclxuICAgICAgICB2YXIgaGVhZGVyQ2VsbCA9IHRoYXQuY3JlYXRlSGVhZGVyQ2VsbChjb2x1bW4sIGZhbHNlKTtcclxuICAgICAgICBpZiAoY29sdW1uLnBpbm5lZCkge1xyXG4gICAgICAgICAgICBlUGlubmVkSGVhZGVyLmFwcGVuZENoaWxkKGhlYWRlckNlbGwpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGVIZWFkZXJDb250YWluZXIuYXBwZW5kQ2hpbGQoaGVhZGVyQ2VsbCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn07XHJcblxyXG5IZWFkZXJSZW5kZXJlci5wcm90b3R5cGUuY3JlYXRlSGVhZGVyQ2VsbCA9IGZ1bmN0aW9uKGNvbHVtbiwgZ3JvdXBlZCwgaGVhZGVyR3JvdXApIHtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIHZhciBjb2xEZWYgPSBjb2x1bW4uY29sRGVmO1xyXG4gICAgdmFyIGVIZWFkZXJDZWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgIC8vIHN0aWNrIHRoZSBoZWFkZXIgY2VsbCBpbiBjb2x1bW4sIGFzIHdlIGFjY2VzcyBpdCB3aGVuIGdyb3VwIGlzIHJlLXNpemVkXHJcbiAgICBjb2x1bW4uZUhlYWRlckNlbGwgPSBlSGVhZGVyQ2VsbDtcclxuXHJcbiAgICB2YXIgaGVhZGVyQ2VsbENsYXNzZXMgPSBbJ2FnLWhlYWRlci1jZWxsJ107XHJcbiAgICBpZiAoZ3JvdXBlZCkge1xyXG4gICAgICAgIGhlYWRlckNlbGxDbGFzc2VzLnB1c2goJ2FnLWhlYWRlci1jZWxsLWdyb3VwZWQnKTsgLy8gdGhpcyB0YWtlcyA1MCUgaGVpZ2h0XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGhlYWRlckNlbGxDbGFzc2VzLnB1c2goJ2FnLWhlYWRlci1jZWxsLW5vdC1ncm91cGVkJyk7IC8vIHRoaXMgdGFrZXMgMTAwJSBoZWlnaHRcclxuICAgIH1cclxuICAgIGVIZWFkZXJDZWxsLmNsYXNzTmFtZSA9IGhlYWRlckNlbGxDbGFzc2VzLmpvaW4oJyAnKTtcclxuXHJcbiAgICAvLyBhZGQgdG9vbHRpcCBpZiBleGlzdHNcclxuICAgIGlmIChjb2xEZWYuaGVhZGVyVG9vbHRpcCkge1xyXG4gICAgICAgIGVIZWFkZXJDZWxsLnRpdGxlID0gY29sRGVmLmhlYWRlclRvb2x0aXA7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzRW5hYmxlQ29sUmVzaXplKCkpIHtcclxuICAgICAgICB2YXIgaGVhZGVyQ2VsbFJlc2l6ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgaGVhZGVyQ2VsbFJlc2l6ZS5jbGFzc05hbWUgPSBcImFnLWhlYWRlci1jZWxsLXJlc2l6ZVwiO1xyXG4gICAgICAgIGVIZWFkZXJDZWxsLmFwcGVuZENoaWxkKGhlYWRlckNlbGxSZXNpemUpO1xyXG4gICAgICAgIHZhciBkcmFnQ2FsbGJhY2sgPSB0aGlzLmhlYWRlckRyYWdDYWxsYmFja0ZhY3RvcnkoZUhlYWRlckNlbGwsIGNvbHVtbiwgaGVhZGVyR3JvdXApO1xyXG4gICAgICAgIHRoaXMuYWRkRHJhZ0hhbmRsZXIoaGVhZGVyQ2VsbFJlc2l6ZSwgZHJhZ0NhbGxiYWNrKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBmaWx0ZXIgYnV0dG9uXHJcbiAgICB2YXIgc2hvd01lbnUgPSB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0VuYWJsZUZpbHRlcigpICYmICFjb2xEZWYuc3VwcHJlc3NNZW51O1xyXG4gICAgaWYgKHNob3dNZW51KSB7XHJcbiAgICAgICAgdmFyIGVNZW51QnV0dG9uID0gdXRpbHMuY3JlYXRlSWNvbignbWVudScsIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLCBjb2x1bW4sIHN2Z0ZhY3RvcnkuY3JlYXRlTWVudVN2Zyk7XHJcbiAgICAgICAgdXRpbHMuYWRkQ3NzQ2xhc3MoZU1lbnVCdXR0b24sICdhZy1oZWFkZXItaWNvbicpO1xyXG5cclxuICAgICAgICBlTWVudUJ1dHRvbi5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcImFnLWhlYWRlci1jZWxsLW1lbnUtYnV0dG9uXCIpO1xyXG4gICAgICAgIGVNZW51QnV0dG9uLm9uY2xpY2sgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdGhhdC5maWx0ZXJNYW5hZ2VyLnNob3dGaWx0ZXIoY29sdW1uLCB0aGlzKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIGVIZWFkZXJDZWxsLmFwcGVuZENoaWxkKGVNZW51QnV0dG9uKTtcclxuICAgICAgICBlSGVhZGVyQ2VsbC5vbm1vdXNlZW50ZXIgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgZU1lbnVCdXR0b24uc3R5bGUub3BhY2l0eSA9IDE7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBlSGVhZGVyQ2VsbC5vbm1vdXNlbGVhdmUgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgZU1lbnVCdXR0b24uc3R5bGUub3BhY2l0eSA9IDA7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBlTWVudUJ1dHRvbi5zdHlsZS5vcGFjaXR5ID0gMDtcclxuICAgICAgICBlTWVudUJ1dHRvbi5zdHlsZVtcIi13ZWJraXQtdHJhbnNpdGlvblwiXSA9IFwib3BhY2l0eSAwLjVzLCBib3JkZXIgMC4yc1wiO1xyXG4gICAgICAgIGVNZW51QnV0dG9uLnN0eWxlW1widHJhbnNpdGlvblwiXSA9IFwib3BhY2l0eSAwLjVzLCBib3JkZXIgMC4yc1wiO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGxhYmVsIGRpdlxyXG4gICAgdmFyIGhlYWRlckNlbGxMYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBoZWFkZXJDZWxsTGFiZWwuY2xhc3NOYW1lID0gXCJhZy1oZWFkZXItY2VsbC1sYWJlbFwiO1xyXG5cclxuICAgIC8vIGFkZCBpbiBzb3J0IGljb25zXHJcbiAgICBpZiAodGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNFbmFibGVTb3J0aW5nKCkgJiYgIWNvbERlZi5zdXBwcmVzc1NvcnRpbmcpIHtcclxuICAgICAgICBjb2x1bW4uZVNvcnRBc2MgPSB1dGlscy5jcmVhdGVJY29uKCdzb3J0QXNjZW5kaW5nJywgdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIsIGNvbHVtbiwgc3ZnRmFjdG9yeS5jcmVhdGVBcnJvd1VwU3ZnKTtcclxuICAgICAgICBjb2x1bW4uZVNvcnREZXNjID0gdXRpbHMuY3JlYXRlSWNvbignc29ydERlc2NlbmRpbmcnLCB0aGlzLmdyaWRPcHRpb25zV3JhcHBlciwgY29sdW1uLCBzdmdGYWN0b3J5LmNyZWF0ZUFycm93RG93blN2Zyk7XHJcbiAgICAgICAgdXRpbHMuYWRkQ3NzQ2xhc3MoY29sdW1uLmVTb3J0QXNjLCAnYWctaGVhZGVyLWljb24nKTtcclxuICAgICAgICB1dGlscy5hZGRDc3NDbGFzcyhjb2x1bW4uZVNvcnREZXNjLCAnYWctaGVhZGVyLWljb24nKTtcclxuICAgICAgICBoZWFkZXJDZWxsTGFiZWwuYXBwZW5kQ2hpbGQoY29sdW1uLmVTb3J0QXNjKTtcclxuICAgICAgICBoZWFkZXJDZWxsTGFiZWwuYXBwZW5kQ2hpbGQoY29sdW1uLmVTb3J0RGVzYyk7XHJcbiAgICAgICAgY29sdW1uLmVTb3J0QXNjLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICAgICAgY29sdW1uLmVTb3J0RGVzYy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgICAgIHRoaXMuYWRkU29ydEhhbmRsaW5nKGhlYWRlckNlbGxMYWJlbCwgY29sdW1uKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBhZGQgaW4gZmlsdGVyIGljb25cclxuICAgIGNvbHVtbi5lRmlsdGVySWNvbiA9IHV0aWxzLmNyZWF0ZUljb24oJ2ZpbHRlcicsIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLCBjb2x1bW4sIHN2Z0ZhY3RvcnkuY3JlYXRlRmlsdGVyU3ZnKTtcclxuICAgIHV0aWxzLmFkZENzc0NsYXNzKGNvbHVtbi5lRmlsdGVySWNvbiwgJ2FnLWhlYWRlci1pY29uJyk7XHJcbiAgICBoZWFkZXJDZWxsTGFiZWwuYXBwZW5kQ2hpbGQoY29sdW1uLmVGaWx0ZXJJY29uKTtcclxuXHJcbiAgICAvLyByZW5kZXIgdGhlIGNlbGwsIHVzZSBhIHJlbmRlcmVyIGlmIG9uZSBpcyBwcm92aWRlZFxyXG4gICAgdmFyIGhlYWRlckNlbGxSZW5kZXJlcjtcclxuICAgIGlmIChjb2xEZWYuaGVhZGVyQ2VsbFJlbmRlcmVyKSB7IC8vIGZpcnN0IGxvb2sgZm9yIGEgcmVuZGVyZXIgaW4gY29sIGRlZlxyXG4gICAgICAgIGhlYWRlckNlbGxSZW5kZXJlciA9IGNvbERlZi5oZWFkZXJDZWxsUmVuZGVyZXI7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldEhlYWRlckNlbGxSZW5kZXJlcigpKSB7IC8vIHNlY29uZCBsb29rIGZvciBvbmUgaW4gZ3JpZCBvcHRpb25zXHJcbiAgICAgICAgaGVhZGVyQ2VsbFJlbmRlcmVyID0gdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0SGVhZGVyQ2VsbFJlbmRlcmVyKCk7XHJcbiAgICB9XHJcbiAgICBpZiAoaGVhZGVyQ2VsbFJlbmRlcmVyKSB7XHJcbiAgICAgICAgLy8gcmVuZGVyZXIgcHJvdmlkZWQsIHVzZSBpdFxyXG4gICAgICAgIHZhciBuZXdDaGlsZFNjb3BlO1xyXG4gICAgICAgIGlmICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0FuZ3VsYXJDb21waWxlSGVhZGVycygpKSB7XHJcbiAgICAgICAgICAgIG5ld0NoaWxkU2NvcGUgPSB0aGlzLiRzY29wZS4kbmV3KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBjZWxsUmVuZGVyZXJQYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIGNvbERlZjogY29sRGVmLFxyXG4gICAgICAgICAgICAkc2NvcGU6IG5ld0NoaWxkU2NvcGUsXHJcbiAgICAgICAgICAgIGNvbnRleHQ6IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldENvbnRleHQoKSxcclxuICAgICAgICAgICAgYXBpOiB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRBcGkoKVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgdmFyIGNlbGxSZW5kZXJlclJlc3VsdCA9IGhlYWRlckNlbGxSZW5kZXJlcihjZWxsUmVuZGVyZXJQYXJhbXMpO1xyXG4gICAgICAgIHZhciBjaGlsZFRvQXBwZW5kO1xyXG4gICAgICAgIGlmICh1dGlscy5pc05vZGVPckVsZW1lbnQoY2VsbFJlbmRlcmVyUmVzdWx0KSkge1xyXG4gICAgICAgICAgICAvLyBhIGRvbSBub2RlIG9yIGVsZW1lbnQgd2FzIHJldHVybmVkLCBzbyBhZGQgY2hpbGRcclxuICAgICAgICAgICAgY2hpbGRUb0FwcGVuZCA9IGNlbGxSZW5kZXJlclJlc3VsdDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UgYXNzdW1lIGl0IHdhcyBodG1sLCBzbyBqdXN0IGluc2VydFxyXG4gICAgICAgICAgICB2YXIgZVRleHRTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XHJcbiAgICAgICAgICAgIGVUZXh0U3Bhbi5pbm5lckhUTUwgPSBjZWxsUmVuZGVyZXJSZXN1bHQ7XHJcbiAgICAgICAgICAgIGNoaWxkVG9BcHBlbmQgPSBlVGV4dFNwYW47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGFuZ3VsYXIgY29tcGlsZSBoZWFkZXIgaWYgb3B0aW9uIGlzIHR1cm5lZCBvblxyXG4gICAgICAgIGlmICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0FuZ3VsYXJDb21waWxlSGVhZGVycygpKSB7XHJcbiAgICAgICAgICAgIG5ld0NoaWxkU2NvcGUuY29sRGVmID0gY29sRGVmO1xyXG4gICAgICAgICAgICBuZXdDaGlsZFNjb3BlLmNvbEluZGV4ID0gY29sRGVmLmluZGV4O1xyXG4gICAgICAgICAgICBuZXdDaGlsZFNjb3BlLmNvbERlZldyYXBwZXIgPSBjb2x1bW47XHJcbiAgICAgICAgICAgIHRoaXMuY2hpbGRTY29wZXMucHVzaChuZXdDaGlsZFNjb3BlKTtcclxuICAgICAgICAgICAgdmFyIGNoaWxkVG9BcHBlbmRDb21waWxlZCA9IHRoaXMuJGNvbXBpbGUoY2hpbGRUb0FwcGVuZCkobmV3Q2hpbGRTY29wZSlbMF07XHJcbiAgICAgICAgICAgIGhlYWRlckNlbGxMYWJlbC5hcHBlbmRDaGlsZChjaGlsZFRvQXBwZW5kQ29tcGlsZWQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGhlYWRlckNlbGxMYWJlbC5hcHBlbmRDaGlsZChjaGlsZFRvQXBwZW5kKTtcclxuICAgICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIG5vIHJlbmRlcmVyLCBkZWZhdWx0IHRleHQgcmVuZGVyXHJcbiAgICAgICAgdmFyIGVJbm5lclRleHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcclxuICAgICAgICBlSW5uZXJUZXh0LmNsYXNzTmFtZSA9ICdhZy1oZWFkZXItY2VsbC10ZXh0JztcclxuICAgICAgICBlSW5uZXJUZXh0LmlubmVySFRNTCA9IGNvbERlZi5kaXNwbGF5TmFtZTtcclxuICAgICAgICBoZWFkZXJDZWxsTGFiZWwuYXBwZW5kQ2hpbGQoZUlubmVyVGV4dCk7XHJcbiAgICB9XHJcblxyXG4gICAgZUhlYWRlckNlbGwuYXBwZW5kQ2hpbGQoaGVhZGVyQ2VsbExhYmVsKTtcclxuICAgIGVIZWFkZXJDZWxsLnN0eWxlLndpZHRoID0gdXRpbHMuZm9ybWF0V2lkdGgoY29sdW1uLmFjdHVhbFdpZHRoKTtcclxuXHJcbiAgICByZXR1cm4gZUhlYWRlckNlbGw7XHJcbn07XHJcblxyXG5IZWFkZXJSZW5kZXJlci5wcm90b3R5cGUuYWRkU29ydEhhbmRsaW5nID0gZnVuY3Rpb24oaGVhZGVyQ2VsbExhYmVsLCBjb2xEZWZXcmFwcGVyKSB7XHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcblxyXG4gICAgaGVhZGVyQ2VsbExhYmVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbihlKSB7XHJcblxyXG4gICAgICAgIC8vIHVwZGF0ZSBzb3J0IG9uIGN1cnJlbnQgY29sXHJcbiAgICAgICAgaWYgKGNvbERlZldyYXBwZXIuc29ydCA9PT0gY29uc3RhbnRzLkRFU0MpIHtcclxuICAgICAgICAgICAgY29sRGVmV3JhcHBlci5zb3J0ID0gbnVsbFxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgaWYgKGNvbERlZldyYXBwZXIuc29ydCA9PT0gY29uc3RhbnRzLkFTQykge1xyXG4gICAgICAgICAgICAgICAgY29sRGVmV3JhcHBlci5zb3J0ID0gY29uc3RhbnRzLkRFU0M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjb2xEZWZXcmFwcGVyLnNvcnQgPSBjb25zdGFudHMuQVNDO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIFVzZWZ1bCBmb3IgZGV0ZXJtaW5pbmcgdGhlIG9yZGVyIGluIHdoaWNoIHRoZSB1c2VyIHNvcnRlZCB0aGUgY29sdW1uczpcclxuICAgICAgICAgICAgY29sRGVmV3JhcHBlci5zb3J0ZWRBdCA9IG5ldyBEYXRlKCkudmFsdWVPZigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gY2xlYXIgc29ydCBvbiBhbGwgY29sdW1ucyBleGNlcHQgdGhpcyBvbmUsIGFuZCB1cGRhdGUgdGhlIGljb25zXHJcbiAgICAgICAgdGhhdC5jb2x1bW5Nb2RlbC5nZXRBbGxDb2x1bW5zKCkuZm9yRWFjaChmdW5jdGlvbihjb2x1bW5Ub0NsZWFyKSB7XHJcbiAgICAgICAgICAgIC8vIERvIG5vdCBjbGVhciBpZiBlaXRoZXIgaG9sZGluZyBzaGlmdCwgb3IgaWYgY29sdW1uIGluIHF1ZXN0aW9uIHdhcyBjbGlja2VkXHJcbiAgICAgICAgICAgIGlmICghKGUuc2hpZnRLZXkgfHwgY29sdW1uVG9DbGVhciA9PT0gY29sRGVmV3JhcHBlcikpIHtcclxuICAgICAgICAgICAgICAgIGNvbHVtblRvQ2xlYXIuc29ydCA9IG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGNoZWNrIGluIGNhc2Ugbm8gc29ydGluZyBvbiB0aGlzIHBhcnRpY3VsYXIgY29sLCBhcyBzb3J0aW5nIGlzIG9wdGlvbmFsIHBlciBjb2xcclxuICAgICAgICAgICAgaWYgKGNvbHVtblRvQ2xlYXIuY29sRGVmLnN1cHByZXNzU29ydGluZykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyB1cGRhdGUgdmlzaWJpbGl0eSBvZiBpY29uc1xyXG4gICAgICAgICAgICB2YXIgc29ydEFzY2VuZGluZyA9IGNvbHVtblRvQ2xlYXIuc29ydCA9PT0gY29uc3RhbnRzLkFTQztcclxuICAgICAgICAgICAgdmFyIHNvcnREZXNjZW5kaW5nID0gY29sdW1uVG9DbGVhci5zb3J0ID09PSBjb25zdGFudHMuREVTQztcclxuXHJcbiAgICAgICAgICAgIGlmIChjb2x1bW5Ub0NsZWFyLmVTb3J0QXNjKSB7XHJcbiAgICAgICAgICAgICAgICBjb2x1bW5Ub0NsZWFyLmVTb3J0QXNjLnN0eWxlLmRpc3BsYXkgPSBzb3J0QXNjZW5kaW5nID8gJ2lubGluZScgOiAnbm9uZSc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGNvbHVtblRvQ2xlYXIuZVNvcnREZXNjKSB7XHJcbiAgICAgICAgICAgICAgICBjb2x1bW5Ub0NsZWFyLmVTb3J0RGVzYy5zdHlsZS5kaXNwbGF5ID0gc29ydERlc2NlbmRpbmcgPyAnaW5saW5lJyA6ICdub25lJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGF0LmFuZ3VsYXJHcmlkLnVwZGF0ZU1vZGVsQW5kUmVmcmVzaChjb25zdGFudHMuU1RFUF9TT1JUKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxuSGVhZGVyUmVuZGVyZXIucHJvdG90eXBlLmdyb3VwRHJhZ0NhbGxiYWNrRmFjdG9yeSA9IGZ1bmN0aW9uKGN1cnJlbnRHcm91cCkge1xyXG4gICAgdmFyIHBhcmVudCA9IHRoaXM7XHJcbiAgICB2YXIgdmlzaWJsZUNvbHVtbnMgPSBjdXJyZW50R3JvdXAudmlzaWJsZUNvbHVtbnM7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG9uRHJhZ1N0YXJ0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdGhpcy5ncm91cFdpZHRoU3RhcnQgPSBjdXJyZW50R3JvdXAuYWN0dWFsV2lkdGg7XHJcbiAgICAgICAgICAgIHRoaXMuY2hpbGRyZW5XaWR0aFN0YXJ0cyA9IFtdO1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIHZpc2libGVDb2x1bW5zLmZvckVhY2goZnVuY3Rpb24oY29sRGVmV3JhcHBlcikge1xyXG4gICAgICAgICAgICAgICAgdGhhdC5jaGlsZHJlbldpZHRoU3RhcnRzLnB1c2goY29sRGVmV3JhcHBlci5hY3R1YWxXaWR0aCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0aGlzLm1pbldpZHRoID0gdmlzaWJsZUNvbHVtbnMubGVuZ3RoICogY29uc3RhbnRzLk1JTl9DT0xfV0lEVEg7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBvbkRyYWdnaW5nOiBmdW5jdGlvbihkcmFnQ2hhbmdlKSB7XHJcblxyXG4gICAgICAgICAgICB2YXIgbmV3V2lkdGggPSB0aGlzLmdyb3VwV2lkdGhTdGFydCArIGRyYWdDaGFuZ2U7XHJcbiAgICAgICAgICAgIGlmIChuZXdXaWR0aCA8IHRoaXMubWluV2lkdGgpIHtcclxuICAgICAgICAgICAgICAgIG5ld1dpZHRoID0gdGhpcy5taW5XaWR0aDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gc2V0IHRoZSBuZXcgd2lkdGggdG8gdGhlIGdyb3VwIGhlYWRlclxyXG4gICAgICAgICAgICB2YXIgbmV3V2lkdGhQeCA9IG5ld1dpZHRoICsgXCJweFwiO1xyXG4gICAgICAgICAgICBjdXJyZW50R3JvdXAuZUhlYWRlckdyb3VwQ2VsbC5zdHlsZS53aWR0aCA9IG5ld1dpZHRoUHg7XHJcbiAgICAgICAgICAgIGN1cnJlbnRHcm91cC5hY3R1YWxXaWR0aCA9IG5ld1dpZHRoO1xyXG5cclxuICAgICAgICAgICAgLy8gZGlzdHJpYnV0ZSB0aGUgbmV3IHdpZHRoIHRvIHRoZSBjaGlsZCBoZWFkZXJzXHJcbiAgICAgICAgICAgIHZhciBjaGFuZ2VSYXRpbyA9IG5ld1dpZHRoIC8gdGhpcy5ncm91cFdpZHRoU3RhcnQ7XHJcbiAgICAgICAgICAgIC8vIGtlZXAgdHJhY2sgb2YgcGl4ZWxzIHVzZWQsIGFuZCBsYXN0IGNvbHVtbiBnZXRzIHRoZSByZW1haW5pbmcsXHJcbiAgICAgICAgICAgIC8vIHRvIGNhdGVyIGZvciByb3VuZGluZyBlcnJvcnMsIGFuZCBtaW4gd2lkdGggYWRqdXN0bWVudHNcclxuICAgICAgICAgICAgdmFyIHBpeGVsc1RvRGlzdHJpYnV0ZSA9IG5ld1dpZHRoO1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIGN1cnJlbnRHcm91cC52aXNpYmxlQ29sdW1ucy5mb3JFYWNoKGZ1bmN0aW9uKGNvbERlZldyYXBwZXIsIGluZGV4KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbm90TGFzdENvbCA9IGluZGV4ICE9PSAodmlzaWJsZUNvbHVtbnMubGVuZ3RoIC0gMSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgbmV3Q2hpbGRTaXplO1xyXG4gICAgICAgICAgICAgICAgaWYgKG5vdExhc3RDb2wpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBpZiBub3QgdGhlIGxhc3QgY29sLCBjYWxjdWxhdGUgdGhlIGNvbHVtbiB3aWR0aCBhcyBub3JtYWxcclxuICAgICAgICAgICAgICAgICAgICB2YXIgc3RhcnRDaGlsZFNpemUgPSB0aGF0LmNoaWxkcmVuV2lkdGhTdGFydHNbaW5kZXhdO1xyXG4gICAgICAgICAgICAgICAgICAgIG5ld0NoaWxkU2l6ZSA9IHN0YXJ0Q2hpbGRTaXplICogY2hhbmdlUmF0aW87XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0NoaWxkU2l6ZSA8IGNvbnN0YW50cy5NSU5fQ09MX1dJRFRIKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NoaWxkU2l6ZSA9IGNvbnN0YW50cy5NSU5fQ09MX1dJRFRIO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBwaXhlbHNUb0Rpc3RyaWJ1dGUgLT0gbmV3Q2hpbGRTaXplO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBpZiBsYXN0IGNvbCwgZ2l2ZSBpdCB0aGUgcmVtYWluaW5nIHBpeGVsc1xyXG4gICAgICAgICAgICAgICAgICAgIG5ld0NoaWxkU2l6ZSA9IHBpeGVsc1RvRGlzdHJpYnV0ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHZhciBlSGVhZGVyQ2VsbCA9IHZpc2libGVDb2x1bW5zW2luZGV4XS5lSGVhZGVyQ2VsbDtcclxuICAgICAgICAgICAgICAgIHBhcmVudC5hZGp1c3RDb2x1bW5XaWR0aChuZXdDaGlsZFNpemUsIGNvbERlZldyYXBwZXIsIGVIZWFkZXJDZWxsKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyBzaG91bGQgbm90IGJlIGNhbGxpbmcgdGhlc2UgaGVyZSwgc2hvdWxkIGRvIHNvbWV0aGluZyBlbHNlXHJcbiAgICAgICAgICAgIGlmIChjdXJyZW50R3JvdXAucGlubmVkKSB7XHJcbiAgICAgICAgICAgICAgICBwYXJlbnQuYW5ndWxhckdyaWQudXBkYXRlUGlubmVkQ29sQ29udGFpbmVyV2lkdGhBZnRlckNvbFJlc2l6ZSgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcGFyZW50LmFuZ3VsYXJHcmlkLnVwZGF0ZUJvZHlDb250YWluZXJXaWR0aEFmdGVyQ29sUmVzaXplKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59O1xyXG5cclxuSGVhZGVyUmVuZGVyZXIucHJvdG90eXBlLmFkanVzdENvbHVtbldpZHRoID0gZnVuY3Rpb24obmV3V2lkdGgsIGNvbHVtbiwgZUhlYWRlckNlbGwpIHtcclxuICAgIHZhciBuZXdXaWR0aFB4ID0gbmV3V2lkdGggKyBcInB4XCI7XHJcbiAgICB2YXIgc2VsZWN0b3JGb3JBbGxDb2xzSW5DZWxsID0gXCIuY2VsbC1jb2wtXCIgKyBjb2x1bW4uaW5kZXg7XHJcbiAgICB2YXIgY2VsbHNGb3JUaGlzQ29sID0gdGhpcy5lUm9vdC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yRm9yQWxsQ29sc0luQ2VsbCk7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNlbGxzRm9yVGhpc0NvbC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGNlbGxzRm9yVGhpc0NvbFtpXS5zdHlsZS53aWR0aCA9IG5ld1dpZHRoUHg7XHJcbiAgICB9XHJcblxyXG4gICAgZUhlYWRlckNlbGwuc3R5bGUud2lkdGggPSBuZXdXaWR0aFB4O1xyXG4gICAgY29sdW1uLmFjdHVhbFdpZHRoID0gbmV3V2lkdGg7XHJcbn07XHJcblxyXG4vLyBnZXRzIGNhbGxlZCB3aGVuIGEgaGVhZGVyIChub3QgYSBoZWFkZXIgZ3JvdXApIGdldHMgcmVzaXplZFxyXG5IZWFkZXJSZW5kZXJlci5wcm90b3R5cGUuaGVhZGVyRHJhZ0NhbGxiYWNrRmFjdG9yeSA9IGZ1bmN0aW9uKGhlYWRlckNlbGwsIGNvbHVtbiwgaGVhZGVyR3JvdXApIHtcclxuICAgIHZhciBwYXJlbnQgPSB0aGlzO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBvbkRyYWdTdGFydDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhcnRXaWR0aCA9IGNvbHVtbi5hY3R1YWxXaWR0aDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG9uRHJhZ2dpbmc6IGZ1bmN0aW9uKGRyYWdDaGFuZ2UpIHtcclxuICAgICAgICAgICAgdmFyIG5ld1dpZHRoID0gdGhpcy5zdGFydFdpZHRoICsgZHJhZ0NoYW5nZTtcclxuICAgICAgICAgICAgaWYgKG5ld1dpZHRoIDwgY29uc3RhbnRzLk1JTl9DT0xfV0lEVEgpIHtcclxuICAgICAgICAgICAgICAgIG5ld1dpZHRoID0gY29uc3RhbnRzLk1JTl9DT0xfV0lEVEg7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHBhcmVudC5hZGp1c3RDb2x1bW5XaWR0aChuZXdXaWR0aCwgY29sdW1uLCBoZWFkZXJDZWxsKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChoZWFkZXJHcm91cCkge1xyXG4gICAgICAgICAgICAgICAgcGFyZW50LnNldFdpZHRoT2ZHcm91cEhlYWRlckNlbGwoaGVhZGVyR3JvdXApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBzaG91bGQgbm90IGJlIGNhbGxpbmcgdGhlc2UgaGVyZSwgc2hvdWxkIGRvIHNvbWV0aGluZyBlbHNlXHJcbiAgICAgICAgICAgIGlmIChjb2x1bW4ucGlubmVkKSB7XHJcbiAgICAgICAgICAgICAgICBwYXJlbnQuYW5ndWxhckdyaWQudXBkYXRlUGlubmVkQ29sQ29udGFpbmVyV2lkdGhBZnRlckNvbFJlc2l6ZSgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcGFyZW50LmFuZ3VsYXJHcmlkLnVwZGF0ZUJvZHlDb250YWluZXJXaWR0aEFmdGVyQ29sUmVzaXplKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59O1xyXG5cclxuSGVhZGVyUmVuZGVyZXIucHJvdG90eXBlLnN0b3BEcmFnZ2luZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5lUm9vdC5zdHlsZS5jdXJzb3IgPSBcIlwiO1xyXG4gICAgdGhpcy5lUm9vdC5vbm1vdXNldXAgPSBudWxsO1xyXG4gICAgdGhpcy5lUm9vdC5vbm1vdXNlbGVhdmUgPSBudWxsO1xyXG4gICAgdGhpcy5lUm9vdC5vbm1vdXNlbW92ZSA9IG51bGw7XHJcbn07XHJcblxyXG5IZWFkZXJSZW5kZXJlci5wcm90b3R5cGUudXBkYXRlRmlsdGVySWNvbnMgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIHRoaXMuY29sdW1uTW9kZWwuZ2V0VmlzaWJsZUNvbHVtbnMoKS5mb3JFYWNoKGZ1bmN0aW9uKGNvbHVtbikge1xyXG4gICAgICAgIC8vIHRvZG86IG5lZWQgdG8gY2hhbmdlIHRoaXMsIHNvIG9ubHkgdXBkYXRlcyBpZiBjb2x1bW4gaXMgdmlzaWJsZVxyXG4gICAgICAgIGlmIChjb2x1bW4uZUZpbHRlckljb24pIHtcclxuICAgICAgICAgICAgdmFyIGZpbHRlclByZXNlbnQgPSB0aGF0LmZpbHRlck1hbmFnZXIuaXNGaWx0ZXJQcmVzZW50Rm9yQ29sKGNvbHVtbi5jb2xLZXkpO1xyXG4gICAgICAgICAgICB2YXIgZGlzcGxheVN0eWxlID0gZmlsdGVyUHJlc2VudCA/ICdpbmxpbmUnIDogJ25vbmUnO1xyXG4gICAgICAgICAgICBjb2x1bW4uZUZpbHRlckljb24uc3R5bGUuZGlzcGxheSA9IGRpc3BsYXlTdHlsZTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gSGVhZGVyUmVuZGVyZXI7XHJcbiIsInZhciBncm91cENyZWF0b3IgPSByZXF1aXJlKCcuL2dyb3VwQ3JlYXRvcicpO1xyXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XHJcbnZhciBjb25zdGFudHMgPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xyXG5cclxuZnVuY3Rpb24gSW5NZW1vcnlSb3dDb250cm9sbGVyKCkge1xyXG4gICAgdGhpcy5jcmVhdGVNb2RlbCgpO1xyXG59XHJcblxyXG5Jbk1lbW9yeVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbihncmlkT3B0aW9uc1dyYXBwZXIsIGNvbHVtbk1vZGVsLCBhbmd1bGFyR3JpZCwgZmlsdGVyTWFuYWdlciwgJHNjb3BlLCBleHByZXNzaW9uU2VydmljZSkge1xyXG4gICAgdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIgPSBncmlkT3B0aW9uc1dyYXBwZXI7XHJcbiAgICB0aGlzLmNvbHVtbk1vZGVsID0gY29sdW1uTW9kZWw7XHJcbiAgICB0aGlzLmFuZ3VsYXJHcmlkID0gYW5ndWxhckdyaWQ7XHJcbiAgICB0aGlzLmZpbHRlck1hbmFnZXIgPSBmaWx0ZXJNYW5hZ2VyO1xyXG4gICAgdGhpcy4kc2NvcGUgPSAkc2NvcGU7XHJcbiAgICB0aGlzLmV4cHJlc3Npb25TZXJ2aWNlID0gZXhwcmVzc2lvblNlcnZpY2U7XHJcblxyXG4gICAgdGhpcy5hbGxSb3dzID0gbnVsbDtcclxuICAgIHRoaXMucm93c0FmdGVyR3JvdXAgPSBudWxsO1xyXG4gICAgdGhpcy5yb3dzQWZ0ZXJGaWx0ZXIgPSBudWxsO1xyXG4gICAgdGhpcy5yb3dzQWZ0ZXJTb3J0ID0gbnVsbDtcclxuICAgIHRoaXMucm93c0FmdGVyTWFwID0gbnVsbDtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuSW5NZW1vcnlSb3dDb250cm9sbGVyLnByb3RvdHlwZS5jcmVhdGVNb2RlbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgdGhpcy5tb2RlbCA9IHtcclxuICAgICAgICAvLyB0aGlzIG1ldGhvZCBpcyBpbXBsZW1lbnRlZCBieSB0aGUgaW5NZW1vcnkgbW9kZWwgb25seSxcclxuICAgICAgICAvLyBpdCBnaXZlcyB0aGUgdG9wIGxldmVsIG9mIHRoZSBzZWxlY3Rpb24uIHVzZWQgYnkgdGhlIHNlbGVjdGlvblxyXG4gICAgICAgIC8vIGNvbnRyb2xsZXIsIHdoZW4gaXQgbmVlZHMgdG8gZG8gYSBmdWxsIHRyYXZlcnNhbFxyXG4gICAgICAgIGdldFRvcExldmVsTm9kZXM6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhhdC5yb3dzQWZ0ZXJHcm91cDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldFZpcnR1YWxSb3c6IGZ1bmN0aW9uKGluZGV4KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGF0LnJvd3NBZnRlck1hcFtpbmRleF07XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpbXBvcnRTZXR0aW5nczogZnVuY3Rpb24oc2V0dGluZ3Mpe1xyXG4gICAgICAgICAgICBpZihzZXR0aW5ncy5maWx0ZXJzKXtcclxuICAgICAgICAgICAgICAgIHZhciBjb2xzID0gdGhhdC5jb2x1bW5Nb2RlbC5nZXRBbGxDb2x1bW5zKCk7XHJcbiAgICAgICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29scy5sZW5ndGg7IGkrKyl7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5maWx0ZXJNYW5hZ2VyLmNyZWF0ZUZpbHRlcihjb2xzW2ldKTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgY3JlYXRlZEZpbHRlciA9IHRoYXQuZmlsdGVyTWFuYWdlci5hbGxGaWx0ZXJzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjb25maWcgPSBzZXR0aW5ncy5maWx0ZXJzW2NvbHNbaV0uY29sRGVmLmZpZWxkXTtcclxuICAgICAgICAgICAgICAgICAgICBpZihjb25maWcpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3VmFsLCBzZWxlY3RlZEZpbHRlcnM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGNvbmZpZy5TZXRGaWx0ZXIgJiYgY3JlYXRlZEZpbHRlci5maWx0ZXIubW9kZWwgJiYgY3JlYXRlZEZpbHRlci5maWx0ZXIubW9kZWwuc2VsZWN0Tm90aGluZyl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkRmlsdGVyLmZpbHRlci5tb2RlbC5zZWxlY3ROb3RoaW5nKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkRmlsdGVyLmZpbHRlci5tb2RlbC5zZWxlY3RlZFZhbHVlc01hcCA9IGNyZWF0ZWRGaWx0ZXIuZmlsdGVyLm1vZGVsLnNlbGVjdGVkVmFsdWVzTWFwIHx8IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnLlNldEZpbHRlci5mb3JFYWNoKGZ1bmN0aW9uKHYpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRGaWx0ZXIuZmlsdGVyLm1vZGVsLnNlbGVjdFZhbHVlKHYpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZihjb25maWcuVGV4dEZpbHRlcil7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkRmlsdGVyLmZpbHRlci5lRmlsdGVyVGV4dEZpZWxkLnZhbHVlID0gY3JlYXRlZEZpbHRlci5maWx0ZXIuZmlsdGVyVGV4dCA9IGNvbmZpZy5UZXh0RmlsdGVyLmZpbHRlclRleHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkRmlsdGVyLmZpbHRlci5lVHlwZVNlbGVjdC52YWx1ZSA9IGNyZWF0ZWRGaWx0ZXIuZmlsdGVyLmZpbHRlclR5cGUgPSBjb25maWcuVGV4dEZpbHRlci5maWx0ZXJUeXBlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYoY29uZmlnLk51bWJlckZpbHRlcil7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkRmlsdGVyLmZpbHRlci5lRmlsdGVyVGV4dEZpZWxkLnZhbHVlID0gY3JlYXRlZEZpbHRlci5maWx0ZXIuZmlsdGVyTnVtYmVyID0gY29uZmlnLlRleHRGaWx0ZXIuZmlsdGVyTnVtYmVyO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEZpbHRlci5maWx0ZXIuZVR5cGVTZWxlY3QudmFsdWUgPSBjcmVhdGVkRmlsdGVyLmZpbHRlci5maWx0ZXJUeXBlID0gY29uZmlnLlRleHRGaWx0ZXIuZmlsdGVyVHlwZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKGNvbmZpZy5CaWROYW1lRmlsdGVyKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRGaWx0ZXIuZmlsdGVyLm51bWJlclRleHQgPSBjb25maWcuQmlkTmFtZUZpbHRlci5udW1iZXJUZXh0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYoY29uZmlnLkRhdGVGaWx0ZXIpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEZpbHRlci5maWx0ZXIuc2VsZWN0ZWREYXRlUGVyaW9kID0gY29uZmlnLkRhdGVGaWx0ZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZihjb25maWcuTXVsdGlWYWx1ZVNlbGVjdEZpbHRlcil7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RlZEZpbHRlcnMgPSBjb25maWcuTXVsdGlWYWx1ZVNlbGVjdEZpbHRlcjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbCA9IGNyZWF0ZWRGaWx0ZXIuZmlsdGVyLnZhbHVlcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKG5ld1ZhbCAmJiBuZXdWYWwubGVuZ3RoID4gMCl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmFsLmZvckVhY2goZnVuY3Rpb24oYWNxKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoc2VsZWN0ZWRGaWx0ZXJzLmluZGV4T2YoYWNxLm5hbWUpID4gLTEpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNxLnNlbGVjdGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuZG9GaWx0ZXIoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LmFuZ3VsYXJHcmlkLnVwZGF0ZU1vZGVsQW5kUmVmcmVzaChjb25zdGFudHMuU1RFUF9GSUxURVIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYW5ndWxhckdyaWQuaGVhZGVyUmVuZGVyZXIudXBkYXRlRmlsdGVySWNvbnMoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoYXQuZG9GaWx0ZXIoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYoc2V0dGluZ3Mub3JkZXJCeUZpZWxkKXtcclxuICAgICAgICAgICAgICAgIHZhciBvcmRlckJ5Q29scyA9IHRoYXQuY29sdW1uTW9kZWwuZ2V0QWxsQ29sdW1ucygpLmZvckVhY2goZnVuY3Rpb24oYyl7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYoYyAmJiBjLmNvbERlZi5maWVsZCA9PT0gc2V0dGluZ3Mub3JkZXJCeUZpZWxkKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYy5zb3J0ID0gc2V0dGluZ3Mub3JkZXJCeURpcmVjdGlvbjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoYy5lU29ydEFzYyAmJiBjLmVTb3J0RGVzYyl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjLmVTb3J0QXNjLnN0eWxlLmRpc3BsYXkgPSBzZXR0aW5ncy5vcmRlckJ5RGlyZWN0aW9uID09PSAnYXNjJyA/ICdpbmxpbmUnIDogJ25vbmUnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYy5lU29ydERlc2Muc3R5bGUuZGlzcGxheSA9IHNldHRpbmdzLm9yZGVyQnlEaXJlY3Rpb24gIT09ICdhc2MnID8gJ2lubGluZScgOiAnbm9uZSc7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB0aGF0LmRvU29ydCgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGF0LmFuZ3VsYXJHcmlkLnVwZGF0ZU1vZGVsQW5kUmVmcmVzaChjb25zdGFudHMuU1RFUF9FVkVSWVRISU5HKTtcclxuICAgICAgICAgICAgdGhhdC5hbmd1bGFyR3JpZC5oZWFkZXJSZW5kZXJlci51cGRhdGVGaWx0ZXJJY29ucygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZXhwb3J0U2V0dGluZ3M6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIHZhciBvcmRlckJ5Q29sdW1uID0gdGhhdC5jb2x1bW5Nb2RlbC5nZXRBbGxDb2x1bW5zKCkuZmlsdGVyKGZ1bmN0aW9uKGMpe1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuICEhYy5zb3J0O1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHZhciBjbGVhbmVkRmlsdGVycyA9IHt9O1xyXG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0aGF0LmZpbHRlck1hbmFnZXIuYWxsRmlsdGVycykuZm9yRWFjaChmdW5jdGlvbihrZXkpe1xyXG4gICAgICAgICAgICAgICAgdmFyIGZpbHRlcldyYXBwZXIgPSB0aGF0LmZpbHRlck1hbmFnZXIuYWxsRmlsdGVyc1trZXldO1xyXG4gICAgICAgICAgICAgICAgdmFyIGNvbmZpZztcclxuXHJcbiAgICAgICAgICAgICAgICBpZighZmlsdGVyV3JhcHBlci5maWx0ZXIuaXNGaWx0ZXJBY3RpdmUoKSl7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmKGZpbHRlcldyYXBwZXIuZmlsdGVyLm1vZGVsICYmIGZpbHRlcldyYXBwZXIuZmlsdGVyLm1vZGVsLnNlbGVjdGVkVmFsdWVzTWFwKXtcclxuICAgICAgICAgICAgICAgICAgICBjb25maWcgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFNldEZpbHRlciA6IE9iamVjdC5rZXlzKGZpbHRlcldyYXBwZXIuZmlsdGVyLm1vZGVsLnNlbGVjdGVkVmFsdWVzTWFwKVxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKGZpbHRlcldyYXBwZXIuZmlsdGVyLmZpbHRlck51bWJlcil7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBOdW1iZXJGaWx0ZXIgOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWx0ZXJOdW1iZXI6IGZpbHRlcldyYXBwZXIuZmlsdGVyLmZpbHRlck51bWJlcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbHRlclR5cGU6IGZpbHRlcldyYXBwZXIuZmlsdGVyLmZpbHRlclR5cGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKGZpbHRlcldyYXBwZXIuZmlsdGVyLmZpbHRlclRleHQpe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZyA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgVGV4dEZpbHRlciA6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbHRlclRleHQ6IGZpbHRlcldyYXBwZXIuZmlsdGVyLmZpbHRlclRleHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWx0ZXJUeXBlOiBmaWx0ZXJXcmFwcGVyLmZpbHRlci5maWx0ZXJUeXBlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZihmaWx0ZXJXcmFwcGVyLmZpbHRlci5zZWxlY3RlZERhdGVQZXJpb2Qpe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZyA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgRGF0ZUZpbHRlciA6IGZpbHRlcldyYXBwZXIuZmlsdGVyLnNlbGVjdGVkRGF0ZVBlcmlvZFxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKGZpbHRlcldyYXBwZXIuZmlsdGVyLnZhbHVlcyl7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBNdWx0aVZhbHVlU2VsZWN0RmlsdGVyIDogZmlsdGVyV3JhcHBlci5maWx0ZXIudmFsdWVzLmZpbHRlcihmdW5jdGlvbihhY3Epe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhY3Euc2VsZWN0ZWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLm1hcChmdW5jdGlvbihhY3Epe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjcS5uYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjbGVhbmVkRmlsdGVyc1tmaWx0ZXJXcmFwcGVyLmZpZWxkXSA9IGNvbmZpZztcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgb3JkZXJCeUZpZWxkOiBvcmRlckJ5Q29sdW1uLmxlbmd0aCA+IDAgPyBvcmRlckJ5Q29sdW1uWzBdLmNvbERlZi5maWVsZCA6IG51bGwsXHJcbiAgICAgICAgICAgICAgICBvcmRlckJ5RGlyZWN0aW9uOiBvcmRlckJ5Q29sdW1uLmxlbmd0aCA+IDAgPyBvcmRlckJ5Q29sdW1uWzBdLnNvcnQgOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgZmlsdGVyczogY2xlYW5lZEZpbHRlcnNcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldFZpcnR1YWxSb3dDb3VudDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGF0LnJvd3NBZnRlck1hcCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoYXQucm93c0FmdGVyTWFwLmxlbmd0aDtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufTtcclxuXHJcbi8vIHB1YmxpY1xyXG5Jbk1lbW9yeVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmdldE1vZGVsID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5tb2RlbDtcclxufTtcclxuXHJcbi8vIHB1YmxpY1xyXG5Jbk1lbW9yeVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLnVwZGF0ZU1vZGVsID0gZnVuY3Rpb24oc3RlcCkge1xyXG5cclxuICAgIC8vIGZhbGx0aHJvdWdoIGluIGJlbG93IHN3aXRjaCBpcyBvbiBwdXJwb3NlXHJcbiAgICBzd2l0Y2ggKHN0ZXApIHtcclxuICAgICAgICBjYXNlIGNvbnN0YW50cy5TVEVQX0VWRVJZVEhJTkc6XHJcbiAgICAgICAgICAgIHRoaXMuZG9Hcm91cGluZygpO1xyXG4gICAgICAgIGNhc2UgY29uc3RhbnRzLlNURVBfRklMVEVSOlxyXG4gICAgICAgICAgICB0aGlzLmRvRmlsdGVyKCk7XHJcbiAgICAgICAgICAgIHRoaXMuZG9BZ2dyZWdhdGUoKTtcclxuICAgICAgICBjYXNlIGNvbnN0YW50cy5TVEVQX1NPUlQ6XHJcbiAgICAgICAgICAgIHRoaXMuZG9Tb3J0KCk7XHJcbiAgICAgICAgY2FzZSBjb25zdGFudHMuU1RFUF9NQVA6XHJcbiAgICAgICAgICAgIHRoaXMuZG9Hcm91cE1hcHBpbmcoKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodHlwZW9mIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldE1vZGVsVXBkYXRlZCgpID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0TW9kZWxVcGRhdGVkKCkoKTtcclxuICAgICAgICB2YXIgJHNjb3BlID0gdGhpcy4kc2NvcGU7XHJcbiAgICAgICAgaWYgKCRzY29wZSkge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgJHNjb3BlLiRhcHBseSgpO1xyXG4gICAgICAgICAgICB9LCAwKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG59O1xyXG5cclxuLy8gcHJpdmF0ZVxyXG5Jbk1lbW9yeVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oZGF0YSwgY29sRGVmLCBub2RlLCByb3dJbmRleCkge1xyXG4gICAgdmFyIGFwaSA9IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldEFwaSgpO1xyXG4gICAgdmFyIGNvbnRleHQgPSB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRDb250ZXh0KCk7XHJcbiAgICByZXR1cm4gdXRpbHMuZ2V0VmFsdWUodGhpcy5leHByZXNzaW9uU2VydmljZSwgZGF0YSwgY29sRGVmLCBub2RlLCByb3dJbmRleCwgYXBpLCBjb250ZXh0KTtcclxufTtcclxuXHJcbi8vIHB1YmxpYyAtIGl0J3MgcG9zc2libGUgdG8gcmVjb21wdXRlIHRoZSBhZ2dyZWdhdGUgd2l0aG91dCBkb2luZyB0aGUgb3RoZXIgcGFydHNcclxuSW5NZW1vcnlSb3dDb250cm9sbGVyLnByb3RvdHlwZS5kb0FnZ3JlZ2F0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cclxuICAgIHZhciBncm91cEFnZ0Z1bmN0aW9uID0gdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0R3JvdXBBZ2dGdW5jdGlvbigpO1xyXG4gICAgaWYgKHR5cGVvZiBncm91cEFnZ0Z1bmN0aW9uICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucmVjdXJzaXZlbHlDcmVhdGVBZ2dEYXRhKHRoaXMucm93c0FmdGVyRmlsdGVyLCBncm91cEFnZ0Z1bmN0aW9uKTtcclxufTtcclxuXHJcbi8vIHB1YmxpY1xyXG5Jbk1lbW9yeVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmV4cGFuZE9yQ29sbGFwc2VBbGwgPSBmdW5jdGlvbihleHBhbmQsIHJvd05vZGVzKSB7XHJcbiAgICAvLyBpZiBmaXJzdCBjYWxsIGluIHJlY3Vyc2lvbiwgd2Ugc2V0IGxpc3QgdG8gcGFyZW50IGxpc3RcclxuICAgIGlmIChyb3dOb2RlcyA9PT0gbnVsbCkge1xyXG4gICAgICAgIHJvd05vZGVzID0gdGhpcy5yb3dzQWZ0ZXJHcm91cDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXJvd05vZGVzKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICByb3dOb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICBpZiAobm9kZS5ncm91cCkge1xyXG4gICAgICAgICAgICBub2RlLmV4cGFuZGVkID0gZXhwYW5kO1xyXG4gICAgICAgICAgICBfdGhpcy5leHBhbmRPckNvbGxhcHNlQWxsKGV4cGFuZCwgbm9kZS5jaGlsZHJlbik7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn07XHJcblxyXG4vLyBwcml2YXRlXHJcbkluTWVtb3J5Um93Q29udHJvbGxlci5wcm90b3R5cGUucmVjdXJzaXZlbHlDcmVhdGVBZ2dEYXRhID0gZnVuY3Rpb24obm9kZXMsIGdyb3VwQWdnRnVuY3Rpb24pIHtcclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gbm9kZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgdmFyIG5vZGUgPSBub2Rlc1tpXTtcclxuICAgICAgICBpZiAobm9kZS5ncm91cCkge1xyXG4gICAgICAgICAgICAvLyBhZ2cgZnVuY3Rpb24gbmVlZHMgdG8gc3RhcnQgYXQgdGhlIGJvdHRvbSwgc28gdHJhdmVyc2UgZmlyc3RcclxuICAgICAgICAgICAgdGhpcy5yZWN1cnNpdmVseUNyZWF0ZUFnZ0RhdGEobm9kZS5jaGlsZHJlbkFmdGVyRmlsdGVyLCBncm91cEFnZ0Z1bmN0aW9uKTtcclxuICAgICAgICAgICAgLy8gYWZ0ZXIgdHJhdmVyc2FsLCB3ZSBjYW4gbm93IGRvIHRoZSBhZ2cgYXQgdGhpcyBsZXZlbFxyXG4gICAgICAgICAgICB2YXIgZGF0YSA9IGdyb3VwQWdnRnVuY3Rpb24obm9kZS5jaGlsZHJlbkFmdGVyRmlsdGVyKTtcclxuICAgICAgICAgICAgbm9kZS5kYXRhID0gZGF0YTtcclxuICAgICAgICAgICAgLy8gaWYgd2UgYXJlIGdyb3VwaW5nLCB0aGVuIGl0J3MgcG9zc2libGUgdGhlcmUgaXMgYSBzaWJsaW5nIGZvb3RlclxyXG4gICAgICAgICAgICAvLyB0byB0aGUgZ3JvdXAsIHNvIHVwZGF0ZSB0aGUgZGF0YSBoZXJlIGFsc28gaWYgdGhlcmUgaXMgb25lXHJcbiAgICAgICAgICAgIGlmIChub2RlLnNpYmxpbmcpIHtcclxuICAgICAgICAgICAgICAgIG5vZGUuc2libGluZy5kYXRhID0gZGF0YTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuSW5NZW1vcnlSb3dDb250cm9sbGVyLnByb3RvdHlwZS5kb1NvcnQgPSBmdW5jdGlvbigpIHtcclxuICAgIC8vc2VlIGlmIHRoZXJlIGlzIGEgY29sIHdlIGFyZSBzb3J0aW5nIGJ5XHJcbiAgICB2YXIgc29ydGluZ09wdGlvbnMgPSBbXTtcclxuICAgIHRoaXMuY29sdW1uTW9kZWwuZ2V0QWxsQ29sdW1ucygpLmZvckVhY2goZnVuY3Rpb24oY29sdW1uKSB7XHJcbiAgICAgICAgaWYgKGNvbHVtbi5zb3J0KSB7XHJcbiAgICAgICAgICAgIHZhciBhc2NlbmRpbmcgPSBjb2x1bW4uc29ydCA9PT0gY29uc3RhbnRzLkFTQztcclxuICAgICAgICAgICAgc29ydGluZ09wdGlvbnMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICBpbnZlcnRlcjogYXNjZW5kaW5nID8gMSA6IC0xLFxyXG4gICAgICAgICAgICAgICAgc29ydGVkQXQ6IGNvbHVtbi5zb3J0ZWRBdCxcclxuICAgICAgICAgICAgICAgIGNvbERlZjogY29sdW1uLmNvbERlZlxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUaGUgY29sdW1ucyBhcmUgdG8gYmUgc29ydGVkIGluIHRoZSBvcmRlciB0aGF0IHRoZSB1c2VyIHNlbGVjdGVkIHRoZW06XHJcbiAgICBzb3J0aW5nT3B0aW9ucy5zb3J0KGZ1bmN0aW9uKG9wdGlvbkEsIG9wdGlvbkIpe1xyXG4gICAgICAgIHJldHVybiBvcHRpb25BLnNvcnRlZEF0IC0gb3B0aW9uQi5zb3J0ZWRBdDtcclxuICAgIH0pO1xyXG5cclxuICAgIHZhciByb3dOb2Rlc0JlZm9yZVNvcnQgPSB0aGlzLnJvd3NBZnRlckZpbHRlci5zbGljZSgwKTtcclxuXHJcbiAgICBpZiAoc29ydGluZ09wdGlvbnMubGVuZ3RoKSB7XHJcbiAgICAgICAgdGhpcy5zb3J0TGlzdChyb3dOb2Rlc0JlZm9yZVNvcnQsIHNvcnRpbmdPcHRpb25zKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gaWYgbm8gc29ydGluZywgc2V0IGFsbCBncm91cCBjaGlsZHJlbiBhZnRlciBzb3J0IHRvIHRoZSBvcmlnaW5hbCBsaXN0XHJcbiAgICAgICAgdGhpcy5yZWN1cnNpdmVseVJlc2V0U29ydChyb3dOb2Rlc0JlZm9yZVNvcnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucm93c0FmdGVyU29ydCA9IHJvd05vZGVzQmVmb3JlU29ydDtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuSW5NZW1vcnlSb3dDb250cm9sbGVyLnByb3RvdHlwZS5yZWN1cnNpdmVseVJlc2V0U29ydCA9IGZ1bmN0aW9uKHJvd05vZGVzKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHJvd05vZGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHZhciBpdGVtID0gcm93Tm9kZXNbaV07XHJcbiAgICAgICAgaWYgKGl0ZW0uZ3JvdXAgJiYgaXRlbS5jaGlsZHJlbikge1xyXG4gICAgICAgICAgICBpdGVtLmNoaWxkcmVuQWZ0ZXJTb3J0ID0gaXRlbS5jaGlsZHJlbkFmdGVyRmlsdGVyO1xyXG4gICAgICAgICAgICB0aGlzLnJlY3Vyc2l2ZWx5UmVzZXRTb3J0KGl0ZW0uY2hpbGRyZW4pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuSW5NZW1vcnlSb3dDb250cm9sbGVyLnByb3RvdHlwZS5zb3J0TGlzdCA9IGZ1bmN0aW9uKG5vZGVzLCBzb3J0T3B0aW9ucykge1xyXG5cclxuICAgIC8vIHNvcnQgYW55IGdyb3VwcyByZWN1cnNpdmVseVxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBub2Rlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHsgLy8gY3JpdGljYWwgc2VjdGlvbiwgbm8gZnVuY3Rpb25hbCBwcm9ncmFtbWluZ1xyXG4gICAgICAgIHZhciBub2RlID0gbm9kZXNbaV07XHJcbiAgICAgICAgaWYgKG5vZGUuZ3JvdXAgJiYgbm9kZS5jaGlsZHJlbikge1xyXG4gICAgICAgICAgICBub2RlLmNoaWxkcmVuQWZ0ZXJTb3J0ID0gbm9kZS5jaGlsZHJlbkFmdGVyRmlsdGVyLnNsaWNlKDApO1xyXG4gICAgICAgICAgICB0aGlzLnNvcnRMaXN0KG5vZGUuY2hpbGRyZW5BZnRlclNvcnQsIHNvcnRPcHRpb25zKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgZnVuY3Rpb24gY29tcGFyZShvYmpBLCBvYmpCLCBjb2xEZWYpe1xyXG4gICAgICAgIHZhciB2YWx1ZUEgPSB0aGF0LmdldFZhbHVlKG9iakEuZGF0YSwgY29sRGVmLCBvYmpBKTtcclxuICAgICAgICB2YXIgdmFsdWVCID0gdGhhdC5nZXRWYWx1ZShvYmpCLmRhdGEsIGNvbERlZiwgb2JqQik7XHJcbiAgICAgICAgaWYgKGNvbERlZi5jb21wYXJhdG9yKSB7XHJcbiAgICAgICAgICAgIC8vaWYgY29tcGFyYXRvciBwcm92aWRlZCwgdXNlIGl0XHJcbiAgICAgICAgICAgIHJldHVybiBjb2xEZWYuY29tcGFyYXRvcih2YWx1ZUEsIHZhbHVlQiwgb2JqQSwgb2JqQik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy9vdGhlcndpc2UgZG8gb3VyIG93biBjb21wYXJpc29uXHJcbiAgICAgICAgICAgIHJldHVybiB1dGlscy5kZWZhdWx0Q29tcGFyYXRvcih2YWx1ZUEsIHZhbHVlQiwgb2JqQSwgb2JqQik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIG5vZGVzLnNvcnQoZnVuY3Rpb24ob2JqQSwgb2JqQikge1xyXG4gICAgICAgIC8vIEl0ZXJhdGUgY29sdW1ucywgcmV0dXJuIHRoZSBmaXJzdCB0aGF0IGRvZXNuJ3QgbWF0Y2hcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gc29ydE9wdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIHNvcnRPcHRpb24gPSBzb3J0T3B0aW9uc1tpXTtcclxuICAgICAgICAgICAgdmFyIGNvbXBhcmVkID0gY29tcGFyZShvYmpBLCBvYmpCLCBzb3J0T3B0aW9uLmNvbERlZik7XHJcbiAgICAgICAgICAgIGlmIChjb21wYXJlZCAhPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbXBhcmVkICogc29ydE9wdGlvbi5pbnZlcnRlcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBBbGwgbWF0Y2hlZCwgdGhlc2UgYXJlIGlkZW50aWNhbCBhcyBmYXIgYXMgdGhlIHNvcnQgaXMgY29uY2VybmVkOlxyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgfSk7XHJcbn07XHJcblxyXG4vLyBwcml2YXRlXHJcbkluTWVtb3J5Um93Q29udHJvbGxlci5wcm90b3R5cGUuZG9Hcm91cGluZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHJvd3NBZnRlckdyb3VwO1xyXG4gICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzRG9JbnRlcm5hbEdyb3VwaW5nKCkpIHtcclxuICAgICAgICB2YXIgZXhwYW5kQnlEZWZhdWx0ID0gdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0R3JvdXBEZWZhdWx0RXhwYW5kZWQoKTtcclxuICAgICAgICByb3dzQWZ0ZXJHcm91cCA9IGdyb3VwQ3JlYXRvci5ncm91cCh0aGlzLmFsbFJvd3MsIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldEdyb3VwS2V5cygpLFxyXG4gICAgICAgICAgICB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRHcm91cEFnZ0Z1bmN0aW9uKCksIGV4cGFuZEJ5RGVmYXVsdCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJvd3NBZnRlckdyb3VwID0gdGhpcy5hbGxSb3dzO1xyXG4gICAgfVxyXG4gICAgdGhpcy5yb3dzQWZ0ZXJHcm91cCA9IHJvd3NBZnRlckdyb3VwO1xyXG59O1xyXG5cclxuLy8gcHJpdmF0ZVxyXG5Jbk1lbW9yeVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmRvRmlsdGVyID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgcXVpY2tGaWx0ZXJQcmVzZW50ID0gdGhpcy5hbmd1bGFyR3JpZC5nZXRRdWlja0ZpbHRlcigpICE9PSBudWxsO1xyXG4gICAgdmFyIGFkdmFuY2VkRmlsdGVyUHJlc2VudCA9IHRoaXMuZmlsdGVyTWFuYWdlci5pc0ZpbHRlclByZXNlbnQoKTtcclxuICAgIHZhciBmaWx0ZXJQcmVzZW50ID0gcXVpY2tGaWx0ZXJQcmVzZW50IHx8IGFkdmFuY2VkRmlsdGVyUHJlc2VudDtcclxuXHJcbiAgICB2YXIgcm93c0FmdGVyRmlsdGVyO1xyXG4gICAgaWYgKGZpbHRlclByZXNlbnQpIHtcclxuICAgICAgICByb3dzQWZ0ZXJGaWx0ZXIgPSB0aGlzLmZpbHRlckl0ZW1zKHRoaXMucm93c0FmdGVyR3JvdXAsIHF1aWNrRmlsdGVyUHJlc2VudCwgYWR2YW5jZWRGaWx0ZXJQcmVzZW50KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gZG8gaXQgaGVyZVxyXG4gICAgICAgIHJvd3NBZnRlckZpbHRlciA9IHRoaXMucm93c0FmdGVyR3JvdXA7XHJcbiAgICAgICAgdGhpcy5yZWN1cnNpdmVseVJlc2V0RmlsdGVyKHRoaXMucm93c0FmdGVyR3JvdXApO1xyXG4gICAgfVxyXG4gICAgdGhpcy5yb3dzQWZ0ZXJGaWx0ZXIgPSByb3dzQWZ0ZXJGaWx0ZXI7XHJcbn07XHJcblxyXG4vLyBwcml2YXRlXHJcbkluTWVtb3J5Um93Q29udHJvbGxlci5wcm90b3R5cGUuZmlsdGVySXRlbXMgPSBmdW5jdGlvbihyb3dOb2RlcywgcXVpY2tGaWx0ZXJQcmVzZW50LCBhZHZhbmNlZEZpbHRlclByZXNlbnQpIHtcclxuICAgIHZhciByZXN1bHQgPSBbXTtcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHJvd05vZGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHZhciBub2RlID0gcm93Tm9kZXNbaV07XHJcblxyXG4gICAgICAgIGlmIChub2RlLmdyb3VwKSB7XHJcbiAgICAgICAgICAgIC8vIGRlYWwgd2l0aCBncm91cFxyXG4gICAgICAgICAgICBub2RlLmNoaWxkcmVuQWZ0ZXJGaWx0ZXIgPSB0aGlzLmZpbHRlckl0ZW1zKG5vZGUuY2hpbGRyZW4sIHF1aWNrRmlsdGVyUHJlc2VudCwgYWR2YW5jZWRGaWx0ZXJQcmVzZW50KTtcclxuICAgICAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW5BZnRlckZpbHRlci5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBub2RlLmFsbENoaWxkcmVuQ291bnQgPSB0aGlzLmdldFRvdGFsQ2hpbGRDb3VudChub2RlLmNoaWxkcmVuQWZ0ZXJGaWx0ZXIpO1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gobm9kZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5kb2VzUm93UGFzc0ZpbHRlcihub2RlLCBxdWlja0ZpbHRlclByZXNlbnQsIGFkdmFuY2VkRmlsdGVyUHJlc2VudCkpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKG5vZGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn07XHJcblxyXG4vLyBwcml2YXRlXHJcbkluTWVtb3J5Um93Q29udHJvbGxlci5wcm90b3R5cGUucmVjdXJzaXZlbHlSZXNldEZpbHRlciA9IGZ1bmN0aW9uKG5vZGVzKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5vZGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHZhciBub2RlID0gbm9kZXNbaV07XHJcbiAgICAgICAgaWYgKG5vZGUuZ3JvdXAgJiYgbm9kZS5jaGlsZHJlbikge1xyXG4gICAgICAgICAgICBub2RlLmNoaWxkcmVuQWZ0ZXJGaWx0ZXIgPSBub2RlLmNoaWxkcmVuO1xyXG4gICAgICAgICAgICBub2RlLmFsbENoaWxkcmVuQ291bnQgPSB0aGlzLmdldFRvdGFsQ2hpbGRDb3VudChub2RlLmNoaWxkcmVuQWZ0ZXJGaWx0ZXIpO1xyXG4gICAgICAgICAgICB0aGlzLnJlY3Vyc2l2ZWx5UmVzZXRGaWx0ZXIobm9kZS5jaGlsZHJlbik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuLy8gcHJpdmF0ZVxyXG4vLyByb3dzOiB0aGUgcm93cyB0byBwdXQgaW50byB0aGUgbW9kZWxcclxuLy8gZmlyc3RJZDogdGhlIGZpcnN0IGlkIHRvIHVzZSwgdXNlZCBmb3IgcGFnaW5nLCB3aGVyZSB3ZSBhcmUgbm90IG9uIHRoZSBmaXJzdCBwYWdlXHJcbkluTWVtb3J5Um93Q29udHJvbGxlci5wcm90b3R5cGUuc2V0QWxsUm93cyA9IGZ1bmN0aW9uKHJvd3MsIGZpcnN0SWQpIHtcclxuICAgIHZhciBub2RlcztcclxuICAgIGlmICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc1Jvd3NBbHJlYWR5R3JvdXBlZCgpKSB7XHJcbiAgICAgICAgbm9kZXMgPSByb3dzO1xyXG4gICAgICAgIHRoaXMucmVjdXJzaXZlbHlDaGVja1VzZXJQcm92aWRlZE5vZGVzKG5vZGVzLCBudWxsLCAwKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gcGxhY2UgZWFjaCByb3cgaW50byBhIHdyYXBwZXJcclxuICAgICAgICB2YXIgbm9kZXMgPSBbXTtcclxuICAgICAgICBpZiAocm93cykge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJvd3MubGVuZ3RoOyBpKyspIHsgLy8gY291bGQgYmUgbG90cyBvZiByb3dzLCBkb24ndCB1c2UgZnVuY3Rpb25hbCBwcm9ncmFtbWluZ1xyXG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogcm93c1tpXVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gaWYgZmlyc3RJZCBwcm92aWRlZCwgdXNlIGl0LCBvdGhlcndpc2Ugc3RhcnQgYXQgMFxyXG4gICAgdmFyIGZpcnN0SWRUb1VzZSA9IGZpcnN0SWQgPyBmaXJzdElkIDogMDtcclxuICAgIHRoaXMucmVjdXJzaXZlbHlBZGRJZFRvTm9kZXMobm9kZXMsIGZpcnN0SWRUb1VzZSk7XHJcbiAgICB0aGlzLmFsbFJvd3MgPSBub2RlcztcclxufTtcclxuXHJcbi8vIGFkZCBpbiBpbmRleCAtIHRoaXMgaXMgdXNlZCBieSB0aGUgc2VsZWN0aW9uQ29udHJvbGxlciAtIHNvIHF1aWNrXHJcbi8vIHRvIGxvb2sgdXAgc2VsZWN0ZWQgcm93c1xyXG5Jbk1lbW9yeVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLnJlY3Vyc2l2ZWx5QWRkSWRUb05vZGVzID0gZnVuY3Rpb24obm9kZXMsIGluZGV4KSB7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFyIG5vZGUgPSBub2Rlc1tpXTtcclxuICAgICAgICBub2RlLmlkID0gaW5kZXgrKztcclxuICAgICAgICBpZiAobm9kZS5ncm91cCAmJiBub2RlLmNoaWxkcmVuKSB7XHJcbiAgICAgICAgICAgIGluZGV4ID0gdGhpcy5yZWN1cnNpdmVseUFkZElkVG9Ob2Rlcyhub2RlLmNoaWxkcmVuLCBpbmRleCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGluZGV4O1xyXG59O1xyXG5cclxuLy8gYWRkIGluIGluZGV4IC0gdGhpcyBpcyB1c2VkIGJ5IHRoZSBzZWxlY3Rpb25Db250cm9sbGVyIC0gc28gcXVpY2tcclxuLy8gdG8gbG9vayB1cCBzZWxlY3RlZCByb3dzXHJcbkluTWVtb3J5Um93Q29udHJvbGxlci5wcm90b3R5cGUucmVjdXJzaXZlbHlDaGVja1VzZXJQcm92aWRlZE5vZGVzID0gZnVuY3Rpb24obm9kZXMsIHBhcmVudCwgbGV2ZWwpIHtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YXIgbm9kZSA9IG5vZGVzW2ldO1xyXG4gICAgICAgIGlmIChwYXJlbnQpIHtcclxuICAgICAgICAgICAgbm9kZS5wYXJlbnQgPSBwYXJlbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5vZGUubGV2ZWwgPSBsZXZlbDtcclxuICAgICAgICBpZiAobm9kZS5ncm91cCAmJiBub2RlLmNoaWxkcmVuKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVjdXJzaXZlbHlDaGVja1VzZXJQcm92aWRlZE5vZGVzKG5vZGUuY2hpbGRyZW4sIG5vZGUsIGxldmVsICsgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuLy8gcHJpdmF0ZVxyXG5Jbk1lbW9yeVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmdldFRvdGFsQ2hpbGRDb3VudCA9IGZ1bmN0aW9uKHJvd05vZGVzKSB7XHJcbiAgICB2YXIgY291bnQgPSAwO1xyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSByb3dOb2Rlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB2YXIgaXRlbSA9IHJvd05vZGVzW2ldO1xyXG4gICAgICAgIGlmIChpdGVtLmdyb3VwKSB7XHJcbiAgICAgICAgICAgIGNvdW50ICs9IGl0ZW0uYWxsQ2hpbGRyZW5Db3VudDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb3VudCsrO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBjb3VudDtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuSW5NZW1vcnlSb3dDb250cm9sbGVyLnByb3RvdHlwZS5jb3B5R3JvdXBOb2RlID0gZnVuY3Rpb24oZ3JvdXBOb2RlLCBjaGlsZHJlbiwgYWxsQ2hpbGRyZW5Db3VudCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBncm91cDogdHJ1ZSxcclxuICAgICAgICBkYXRhOiBncm91cE5vZGUuZGF0YSxcclxuICAgICAgICBmaWVsZDogZ3JvdXBOb2RlLmZpZWxkLFxyXG4gICAgICAgIGtleTogZ3JvdXBOb2RlLmtleSxcclxuICAgICAgICBleHBhbmRlZDogZ3JvdXBOb2RlLmV4cGFuZGVkLFxyXG4gICAgICAgIGNoaWxkcmVuOiBjaGlsZHJlbixcclxuICAgICAgICBhbGxDaGlsZHJlbkNvdW50OiBhbGxDaGlsZHJlbkNvdW50LFxyXG4gICAgICAgIGxldmVsOiBncm91cE5vZGUubGV2ZWxcclxuICAgIH07XHJcbn07XHJcblxyXG4vLyBwcml2YXRlXHJcbkluTWVtb3J5Um93Q29udHJvbGxlci5wcm90b3R5cGUuZG9Hcm91cE1hcHBpbmcgPSBmdW5jdGlvbigpIHtcclxuICAgIC8vIGV2ZW4gaWYgbm90IGdvaW5nIGdyb3VwaW5nLCB3ZSBkbyB0aGUgbWFwcGluZywgYXMgdGhlIGNsaWVudCBtaWdodFxyXG4gICAgLy8gb2YgcGFzc2VkIGluIGRhdGEgdGhhdCBhbHJlYWR5IGhhcyBhIGdyb3VwaW5nIGluIGl0IHNvbWV3aGVyZVxyXG4gICAgdmFyIHJvd3NBZnRlck1hcCA9IFtdO1xyXG4gICAgdGhpcy5hZGRUb01hcChyb3dzQWZ0ZXJNYXAsIHRoaXMucm93c0FmdGVyU29ydCk7XHJcbiAgICB0aGlzLnJvd3NBZnRlck1hcCA9IHJvd3NBZnRlck1hcDtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuSW5NZW1vcnlSb3dDb250cm9sbGVyLnByb3RvdHlwZS5hZGRUb01hcCA9IGZ1bmN0aW9uKG1hcHBlZERhdGEsIG9yaWdpbmFsTm9kZXMpIHtcclxuICAgIGlmICghb3JpZ2luYWxOb2Rlcykge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3JpZ2luYWxOb2Rlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciBub2RlID0gb3JpZ2luYWxOb2Rlc1tpXTtcclxuICAgICAgICBtYXBwZWREYXRhLnB1c2gobm9kZSk7XHJcbiAgICAgICAgaWYgKG5vZGUuZ3JvdXAgJiYgbm9kZS5leHBhbmRlZCkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZFRvTWFwKG1hcHBlZERhdGEsIG5vZGUuY2hpbGRyZW5BZnRlclNvcnQpO1xyXG5cclxuICAgICAgICAgICAgLy8gcHV0IGEgZm9vdGVyIGluIGlmIHVzZXIgaXMgbG9va2luZyBmb3IgaXRcclxuICAgICAgICAgICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzR3JvdXBJbmNsdWRlRm9vdGVyKCkpIHtcclxuICAgICAgICAgICAgICAgIHZhciBmb290ZXJOb2RlID0gdGhpcy5jcmVhdGVGb290ZXJOb2RlKG5vZGUpO1xyXG4gICAgICAgICAgICAgICAgbWFwcGVkRGF0YS5wdXNoKGZvb3Rlck5vZGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuLy8gcHJpdmF0ZVxyXG5Jbk1lbW9yeVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmNyZWF0ZUZvb3Rlck5vZGUgPSBmdW5jdGlvbihncm91cE5vZGUpIHtcclxuICAgIHZhciBmb290ZXJOb2RlID0ge307XHJcbiAgICBPYmplY3Qua2V5cyhncm91cE5vZGUpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XHJcbiAgICAgICAgZm9vdGVyTm9kZVtrZXldID0gZ3JvdXBOb2RlW2tleV07XHJcbiAgICB9KTtcclxuICAgIGZvb3Rlck5vZGUuZm9vdGVyID0gdHJ1ZTtcclxuICAgIC8vIGdldCBib3RoIGhlYWRlciBhbmQgZm9vdGVyIHRvIHJlZmVyZW5jZSBlYWNoIG90aGVyIGFzIHNpYmxpbmdzLiB0aGlzIGlzIG5ldmVyIHVuZG9uZSxcclxuICAgIC8vIG9ubHkgb3ZlcndyaXR0ZW4uIHNvIGlmIGEgZ3JvdXAgaXMgZXhwYW5kZWQsIHRoZW4gY29udHJhY3RlZCwgaXQgd2lsbCBoYXZlIGEgZ2hvc3RcclxuICAgIC8vIHNpYmxpbmcgLSBidXQgdGhhdCdzIGZpbmUsIGFzIHdlIGNhbiBpZ25vcmUgdGhpcyBpZiB0aGUgaGVhZGVyIGlzIGNvbnRyYWN0ZWQuXHJcbiAgICBmb290ZXJOb2RlLnNpYmxpbmcgPSBncm91cE5vZGU7XHJcbiAgICBncm91cE5vZGUuc2libGluZyA9IGZvb3Rlck5vZGU7XHJcbiAgICByZXR1cm4gZm9vdGVyTm9kZTtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuSW5NZW1vcnlSb3dDb250cm9sbGVyLnByb3RvdHlwZS5kb2VzUm93UGFzc0ZpbHRlciA9IGZ1bmN0aW9uKG5vZGUsIHF1aWNrRmlsdGVyUHJlc2VudCwgYWR2YW5jZWRGaWx0ZXJQcmVzZW50KSB7XHJcbiAgICAvL2ZpcnN0IHVwLCBjaGVjayBxdWljayBmaWx0ZXJcclxuICAgIGlmIChxdWlja0ZpbHRlclByZXNlbnQpIHtcclxuICAgICAgICBpZiAoIW5vZGUucXVpY2tGaWx0ZXJBZ2dyZWdhdGVUZXh0KSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWdncmVnYXRlUm93Rm9yUXVpY2tGaWx0ZXIobm9kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChub2RlLnF1aWNrRmlsdGVyQWdncmVnYXRlVGV4dC5pbmRleE9mKHRoaXMuYW5ndWxhckdyaWQuZ2V0UXVpY2tGaWx0ZXIoKSkgPCAwKSB7XHJcbiAgICAgICAgICAgIC8vcXVpY2sgZmlsdGVyIGZhaWxzLCBzbyBza2lwIGl0ZW1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvL3NlY29uZCwgY2hlY2sgYWR2YW5jZWQgZmlsdGVyXHJcbiAgICBpZiAoYWR2YW5jZWRGaWx0ZXJQcmVzZW50KSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmZpbHRlck1hbmFnZXIuZG9lc0ZpbHRlclBhc3Mobm9kZSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvL2dvdCB0aGlzIGZhciwgYWxsIGZpbHRlcnMgcGFzc1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbn07XHJcblxyXG4vLyBwcml2YXRlXHJcbkluTWVtb3J5Um93Q29udHJvbGxlci5wcm90b3R5cGUuYWdncmVnYXRlUm93Rm9yUXVpY2tGaWx0ZXIgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICB2YXIgYWdncmVnYXRlZFRleHQgPSAnJztcclxuICAgIHRoaXMuY29sdW1uTW9kZWwuZ2V0QWxsQ29sdW1ucygpLmZvckVhY2goZnVuY3Rpb24oY29sRGVmV3JhcHBlcikge1xyXG4gICAgICAgIHZhciBkYXRhID0gbm9kZS5kYXRhO1xyXG4gICAgICAgIHZhciB2YWx1ZSA9IGRhdGEgPyBkYXRhW2NvbERlZldyYXBwZXIuY29sRGVmLmZpZWxkXSA6IG51bGw7XHJcbiAgICAgICAgaWYgKHZhbHVlICYmIHZhbHVlICE9PSAnJykge1xyXG4gICAgICAgICAgICBhZ2dyZWdhdGVkVGV4dCA9IGFnZ3JlZ2F0ZWRUZXh0ICsgdmFsdWUudG9TdHJpbmcoKS50b1VwcGVyQ2FzZSgpICsgXCJfXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBub2RlLnF1aWNrRmlsdGVyQWdncmVnYXRlVGV4dCA9IGFnZ3JlZ2F0ZWRUZXh0O1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBJbk1lbW9yeVJvd0NvbnRyb2xsZXI7XHJcbiIsIi8vIEFuZ3VsYXIgR3JpZFxyXG4vLyBXcml0dGVuIGJ5IE5pYWxsIENyb3NieVxyXG4vLyB3d3cuYW5ndWxhcmdyaWQuY29tXHJcbi8vXHJcbi8vIFZlcnNpb24gMS40LjFcclxuXHJcbihmdW5jdGlvbigpIHtcclxuXHJcbiAgICAvLyBFc3RhYmxpc2ggdGhlIHJvb3Qgb2JqZWN0LCBgd2luZG93YCBvciBgZXhwb3J0c2BcclxuICAgIHZhciByb290ID0gdGhpcztcclxuICAgIHZhciBHcmlkID0gcmVxdWlyZSgnLi9ncmlkJyk7XHJcblxyXG4gICAgLy8gaWYgYW5ndWxhciBpcyBwcmVzZW50LCByZWdpc3RlciB0aGUgZGlyZWN0aXZlXHJcbiAgICBpZiAodHlwZW9mIGFuZ3VsYXIgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgdmFyIGFuZ3VsYXJNb2R1bGUgPSBhbmd1bGFyLm1vZHVsZShcImFuZ3VsYXJHcmlkXCIsIFtdKTtcclxuICAgICAgICBhbmd1bGFyTW9kdWxlLmRpcmVjdGl2ZShcImFuZ3VsYXJHcmlkXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgcmVzdHJpY3Q6IFwiQVwiLFxyXG4gICAgICAgICAgICAgICAgY29udHJvbGxlcjogWyckZWxlbWVudCcsICckc2NvcGUnLCAnJGNvbXBpbGUnLCBBbmd1bGFyRGlyZWN0aXZlQ29udHJvbGxlcl0sXHJcbiAgICAgICAgICAgICAgICBzY29wZToge1xyXG4gICAgICAgICAgICAgICAgICAgIGFuZ3VsYXJHcmlkOiBcIj1cIlxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcclxuICAgICAgICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gYW5ndWxhckdyaWRHbG9iYWxGdW5jdGlvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZXhwb3J0cy5hbmd1bGFyR3JpZCA9IGFuZ3VsYXJHcmlkR2xvYmFsRnVuY3Rpb247XHJcbiAgICB9XHJcblxyXG4gICAgcm9vdC5hbmd1bGFyR3JpZCA9IGFuZ3VsYXJHcmlkR2xvYmFsRnVuY3Rpb247XHJcblxyXG4gICAgZnVuY3Rpb24gQW5ndWxhckRpcmVjdGl2ZUNvbnRyb2xsZXIoJGVsZW1lbnQsICRzY29wZSwgJGNvbXBpbGUpIHtcclxuICAgICAgICB2YXIgZUdyaWREaXYgPSAkZWxlbWVudFswXTtcclxuICAgICAgICB2YXIgZ3JpZE9wdGlvbnMgPSAkc2NvcGUuYW5ndWxhckdyaWQ7XHJcbiAgICAgICAgaWYgKCFncmlkT3B0aW9ucykge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJXQVJOSU5HIC0gZ3JpZCBvcHRpb25zIGZvciBBbmd1bGFyIEdyaWQgbm90IGZvdW5kLiBQbGVhc2UgZW5zdXJlIHRoZSBhdHRyaWJ1dGUgYW5ndWxhci1ncmlkIHBvaW50cyB0byBhIHZhbGlkIG9iamVjdCBvbiB0aGUgc2NvcGVcIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGdyaWQgPSBuZXcgR3JpZChlR3JpZERpdiwgZ3JpZE9wdGlvbnMsICRzY29wZSwgJGNvbXBpbGUpO1xyXG5cclxuICAgICAgICAkc2NvcGUuJG9uKFwiJGRlc3Ryb3lcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIGdyaWQuc2V0RmluaXNoZWQoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBHbG9iYWwgRnVuY3Rpb24gLSB0aGlzIGZ1bmN0aW9uIGlzIHVzZWQgZm9yIGNyZWF0aW5nIGEgZ3JpZCwgb3V0c2lkZSBvZiBhbnkgQW5ndWxhckpTXHJcbiAgICBmdW5jdGlvbiBhbmd1bGFyR3JpZEdsb2JhbEZ1bmN0aW9uKGVsZW1lbnQsIGdyaWRPcHRpb25zKSB7XHJcbiAgICAgICAgLy8gc2VlIGlmIGVsZW1lbnQgaXMgYSBxdWVyeSBzZWxlY3Rvciwgb3IgYSByZWFsIGVsZW1lbnRcclxuICAgICAgICB2YXIgZUdyaWREaXY7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICBlR3JpZERpdiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWxlbWVudCk7XHJcbiAgICAgICAgICAgIGlmICghZUdyaWREaXYpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdXQVJOSU5HIC0gd2FzIG5vdCBhYmxlIHRvIGZpbmQgZWxlbWVudCAnICsgZWxlbWVudCArICcgaW4gdGhlIERPTSwgQW5ndWxhciBHcmlkIGluaXRpYWxpc2F0aW9uIGFib3J0ZWQuJyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBlR3JpZERpdiA9IGVsZW1lbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG5ldyBHcmlkKGVHcmlkRGl2LCBncmlkT3B0aW9ucywgbnVsbCwgbnVsbCk7XHJcbiAgICB9XHJcblxyXG59KS5jYWxsKHdpbmRvdyk7XHJcbiIsInZhciBURU1QTEFURSA9IFtcclxuICAgICc8c3BhbiBpZD1cInBhZ2VSb3dTdW1tYXJ5UGFuZWxcIiBjbGFzcz1cImFnLXBhZ2luZy1yb3ctc3VtbWFyeS1wYW5lbFwiPicsXHJcbiAgICAnPHNwYW4gaWQ9XCJmaXJzdFJvd09uUGFnZVwiPjwvc3Bhbj4nLFxyXG4gICAgJyB0byAnLFxyXG4gICAgJzxzcGFuIGlkPVwibGFzdFJvd09uUGFnZVwiPjwvc3Bhbj4nLFxyXG4gICAgJyBvZiAnLFxyXG4gICAgJzxzcGFuIGlkPVwicmVjb3JkQ291bnRcIj48L3NwYW4+JyxcclxuICAgICc8L3NwYW4+JyxcclxuICAgICc8c3BhbiBjbGFzcz1cImFnLXBhZ2luZy1wYWdlLXN1bW1hcnktcGFuZWxcIj4nLFxyXG4gICAgJzxidXR0b24gY2xhc3M9XCJhZy1wYWdpbmctYnV0dG9uXCIgaWQ9XCJidEZpcnN0XCI+Rmlyc3Q8L2J1dHRvbj4nLFxyXG4gICAgJzxidXR0b24gY2xhc3M9XCJhZy1wYWdpbmctYnV0dG9uXCIgaWQ9XCJidFByZXZpb3VzXCI+UHJldmlvdXM8L2J1dHRvbj4nLFxyXG4gICAgJyBQYWdlICcsXHJcbiAgICAnPHNwYW4gaWQ9XCJjdXJyZW50XCI+PC9zcGFuPicsXHJcbiAgICAnIG9mICcsXHJcbiAgICAnPHNwYW4gaWQ9XCJ0b3RhbFwiPjwvc3Bhbj4nLFxyXG4gICAgJzxidXR0b24gY2xhc3M9XCJhZy1wYWdpbmctYnV0dG9uXCIgaWQ9XCJidE5leHRcIj5OZXh0PC9idXR0b24+JyxcclxuICAgICc8YnV0dG9uIGNsYXNzPVwiYWctcGFnaW5nLWJ1dHRvblwiIGlkPVwiYnRMYXN0XCI+TGFzdDwvYnV0dG9uPicsXHJcbiAgICAnPC9zcGFuPidcclxuXS5qb2luKCcnKTtcclxuXHJcbmZ1bmN0aW9uIFBhZ2luYXRpb25Db250cm9sbGVyKCkge31cclxuXHJcblBhZ2luYXRpb25Db250cm9sbGVyLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oZVBhZ2luZ1BhbmVsLCBhbmd1bGFyR3JpZCkge1xyXG4gICAgdGhpcy5hbmd1bGFyR3JpZCA9IGFuZ3VsYXJHcmlkO1xyXG4gICAgdGhpcy5wb3B1bGF0ZVBhbmVsKGVQYWdpbmdQYW5lbCk7XHJcbiAgICB0aGlzLmNhbGxWZXJzaW9uID0gMDtcclxufTtcclxuXHJcblBhZ2luYXRpb25Db250cm9sbGVyLnByb3RvdHlwZS5zZXREYXRhc291cmNlID0gZnVuY3Rpb24oZGF0YXNvdXJjZSkge1xyXG4gICAgdGhpcy5kYXRhc291cmNlID0gZGF0YXNvdXJjZTtcclxuXHJcbiAgICBpZiAoIWRhdGFzb3VyY2UpIHtcclxuICAgICAgICAvLyBvbmx5IGNvbnRpbnVlIGlmIHdlIGhhdmUgYSB2YWxpZCBkYXRhc291cmNlIHRvIHdvcmsgd2l0aFxyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnJlc2V0KCk7XHJcbn07XHJcblxyXG5QYWdpbmF0aW9uQ29udHJvbGxlci5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcclxuICAgIC8vIGNvcHkgcGFnZVNpemUsIHRvIGd1YXJkIGFnYWluc3QgaXQgY2hhbmdpbmcgdGhlIHRoZSBkYXRhc291cmNlIGJldHdlZW4gY2FsbHNcclxuICAgIHRoaXMucGFnZVNpemUgPSB0aGlzLmRhdGFzb3VyY2UucGFnZVNpemU7XHJcbiAgICAvLyBzZWUgaWYgd2Uga25vdyB0aGUgdG90YWwgbnVtYmVyIG9mIHBhZ2VzLCBvciBpZiBpdCdzICd0byBiZSBkZWNpZGVkJ1xyXG4gICAgaWYgKHR5cGVvZiB0aGlzLmRhdGFzb3VyY2Uucm93Q291bnQgPT09ICdudW1iZXInICYmIHRoaXMuZGF0YXNvdXJjZS5yb3dDb3VudCA+PSAwKSB7XHJcbiAgICAgICAgdGhpcy5yb3dDb3VudCA9IHRoaXMuZGF0YXNvdXJjZS5yb3dDb3VudDtcclxuICAgICAgICB0aGlzLmZvdW5kTWF4Um93ID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLmNhbGN1bGF0ZVRvdGFsUGFnZXMoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5yb3dDb3VudCA9IDA7XHJcbiAgICAgICAgdGhpcy5mb3VuZE1heFJvdyA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMudG90YWxQYWdlcyA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5jdXJyZW50UGFnZSA9IDA7XHJcblxyXG4gICAgLy8gaGlkZSB0aGUgc3VtbWFyeSBwYW5lbCB1bnRpbCBzb21ldGhpbmcgaXMgbG9hZGVkXHJcbiAgICB0aGlzLmVQYWdlUm93U3VtbWFyeVBhbmVsLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcclxuXHJcbiAgICB0aGlzLnNldFRvdGFsTGFiZWxzKCk7XHJcbiAgICB0aGlzLmxvYWRQYWdlKCk7XHJcbn07XHJcblxyXG5QYWdpbmF0aW9uQ29udHJvbGxlci5wcm90b3R5cGUuc2V0VG90YWxMYWJlbHMgPSBmdW5jdGlvbigpIHtcclxuICAgIGlmICh0aGlzLmZvdW5kTWF4Um93KSB7XHJcbiAgICAgICAgdGhpcy5sYlRvdGFsLmlubmVySFRNTCA9IHRoaXMudG90YWxQYWdlcy50b0xvY2FsZVN0cmluZygpO1xyXG4gICAgICAgIHRoaXMubGJSZWNvcmRDb3VudC5pbm5lckhUTUwgPSB0aGlzLnJvd0NvdW50LnRvTG9jYWxlU3RyaW5nKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMubGJUb3RhbC5pbm5lckhUTUwgPSAnbW9yZSc7XHJcbiAgICAgICAgdGhpcy5sYlJlY29yZENvdW50LmlubmVySFRNTCA9ICdtb3JlJztcclxuICAgIH1cclxufTtcclxuXHJcblBhZ2luYXRpb25Db250cm9sbGVyLnByb3RvdHlwZS5jYWxjdWxhdGVUb3RhbFBhZ2VzID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnRvdGFsUGFnZXMgPSBNYXRoLmZsb29yKCh0aGlzLnJvd0NvdW50IC0gMSkgLyB0aGlzLnBhZ2VTaXplKSArIDE7XHJcbn07XHJcblxyXG5QYWdpbmF0aW9uQ29udHJvbGxlci5wcm90b3R5cGUucGFnZUxvYWRlZCA9IGZ1bmN0aW9uKHJvd3MsIGxhc3RSb3dJbmRleCkge1xyXG4gICAgdmFyIGZpcnN0SWQgPSB0aGlzLmN1cnJlbnRQYWdlICogdGhpcy5wYWdlU2l6ZTtcclxuICAgIHRoaXMuYW5ndWxhckdyaWQuc2V0Um93cyhyb3dzLCBmaXJzdElkKTtcclxuICAgIC8vIHNlZSBpZiB3ZSBoaXQgdGhlIGxhc3Qgcm93XHJcbiAgICBpZiAoIXRoaXMuZm91bmRNYXhSb3cgJiYgdHlwZW9mIGxhc3RSb3dJbmRleCA9PT0gJ251bWJlcicgJiYgbGFzdFJvd0luZGV4ID49IDApIHtcclxuICAgICAgICB0aGlzLmZvdW5kTWF4Um93ID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLnJvd0NvdW50ID0gbGFzdFJvd0luZGV4O1xyXG4gICAgICAgIHRoaXMuY2FsY3VsYXRlVG90YWxQYWdlcygpO1xyXG4gICAgICAgIHRoaXMuc2V0VG90YWxMYWJlbHMoKTtcclxuXHJcbiAgICAgICAgLy8gaWYgb3ZlcnNob3QgcGFnZXMsIGdvIGJhY2tcclxuICAgICAgICBpZiAodGhpcy5jdXJyZW50UGFnZSA+IHRoaXMudG90YWxQYWdlcykge1xyXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRQYWdlID0gdGhpcy50b3RhbFBhZ2VzIC0gMTtcclxuICAgICAgICAgICAgdGhpcy5sb2FkUGFnZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHRoaXMuZW5hYmxlT3JEaXNhYmxlQnV0dG9ucygpO1xyXG4gICAgdGhpcy51cGRhdGVSb3dMYWJlbHMoKTtcclxufTtcclxuXHJcblBhZ2luYXRpb25Db250cm9sbGVyLnByb3RvdHlwZS51cGRhdGVSb3dMYWJlbHMgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzdGFydFJvdztcclxuICAgIHZhciBlbmRSb3c7XHJcbiAgICBpZiAodGhpcy5pc1plcm9QYWdlc1RvRGlzcGxheSgpKSB7XHJcbiAgICAgICAgc3RhcnRSb3cgPSAwO1xyXG4gICAgICAgIGVuZFJvdyA9IDA7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHN0YXJ0Um93ID0gKHRoaXMucGFnZVNpemUgKiB0aGlzLmN1cnJlbnRQYWdlKSArIDE7XHJcbiAgICAgICAgZW5kUm93ID0gc3RhcnRSb3cgKyB0aGlzLnBhZ2VTaXplIC0gMTtcclxuICAgICAgICBpZiAodGhpcy5mb3VuZE1heFJvdyAmJiBlbmRSb3cgPiB0aGlzLnJvd0NvdW50KSB7XHJcbiAgICAgICAgICAgIGVuZFJvdyA9IHRoaXMucm93Q291bnQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgdGhpcy5sYkZpcnN0Um93T25QYWdlLmlubmVySFRNTCA9IChzdGFydFJvdykudG9Mb2NhbGVTdHJpbmcoKTtcclxuICAgIHRoaXMubGJMYXN0Um93T25QYWdlLmlubmVySFRNTCA9IChlbmRSb3cpLnRvTG9jYWxlU3RyaW5nKCk7XHJcblxyXG4gICAgLy8gc2hvdyB0aGUgc3VtbWFyeSBwYW5lbCwgd2hlbiBmaXJzdCBzaG93biwgdGhpcyBpcyBibGFua1xyXG4gICAgdGhpcy5lUGFnZVJvd1N1bW1hcnlQYW5lbC5zdHlsZS52aXNpYmlsaXR5ID0gbnVsbDtcclxufTtcclxuXHJcblBhZ2luYXRpb25Db250cm9sbGVyLnByb3RvdHlwZS5sb2FkUGFnZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5lbmFibGVPckRpc2FibGVCdXR0b25zKCk7XHJcbiAgICB2YXIgc3RhcnRSb3cgPSB0aGlzLmN1cnJlbnRQYWdlICogdGhpcy5kYXRhc291cmNlLnBhZ2VTaXplO1xyXG4gICAgdmFyIGVuZFJvdyA9ICh0aGlzLmN1cnJlbnRQYWdlICsgMSkgKiB0aGlzLmRhdGFzb3VyY2UucGFnZVNpemU7XHJcblxyXG4gICAgdGhpcy5sYkN1cnJlbnQuaW5uZXJIVE1MID0gKHRoaXMuY3VycmVudFBhZ2UgKyAxKS50b0xvY2FsZVN0cmluZygpO1xyXG5cclxuICAgIHRoaXMuY2FsbFZlcnNpb24rKztcclxuICAgIHZhciBjYWxsVmVyc2lvbkNvcHkgPSB0aGlzLmNhbGxWZXJzaW9uO1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgdGhpcy5hbmd1bGFyR3JpZC5zaG93TG9hZGluZ1BhbmVsKHRydWUpO1xyXG4gICAgdGhpcy5kYXRhc291cmNlLmdldFJvd3Moc3RhcnRSb3csIGVuZFJvdyxcclxuICAgICAgICBmdW5jdGlvbiBzdWNjZXNzKHJvd3MsIGxhc3RSb3dJbmRleCkge1xyXG4gICAgICAgICAgICBpZiAodGhhdC5pc0NhbGxEYWVtb24oY2FsbFZlcnNpb25Db3B5KSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoYXQucGFnZUxvYWRlZChyb3dzLCBsYXN0Um93SW5kZXgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZnVuY3Rpb24gZmFpbCgpIHtcclxuICAgICAgICAgICAgaWYgKHRoYXQuaXNDYWxsRGFlbW9uKGNhbGxWZXJzaW9uQ29weSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBzZXQgaW4gYW4gZW1wdHkgc2V0IG9mIHJvd3MsIHRoaXMgd2lsbCBhdFxyXG4gICAgICAgICAgICAvLyBsZWFzdCBnZXQgcmlkIG9mIHRoZSBsb2FkaW5nIHBhbmVsLCBhbmRcclxuICAgICAgICAgICAgLy8gc3RvcCBibG9ja2luZyB0aGluZ3NcclxuICAgICAgICAgICAgdGhhdC5hbmd1bGFyR3JpZC5zZXRSb3dzKFtdKTtcclxuICAgICAgICB9XHJcbiAgICApO1xyXG59O1xyXG5cclxuUGFnaW5hdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLmlzQ2FsbERhZW1vbiA9IGZ1bmN0aW9uKHZlcnNpb25Db3B5KSB7XHJcbiAgICByZXR1cm4gdmVyc2lvbkNvcHkgIT09IHRoaXMuY2FsbFZlcnNpb247XHJcbn07XHJcblxyXG5QYWdpbmF0aW9uQ29udHJvbGxlci5wcm90b3R5cGUub25CdE5leHQgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY3VycmVudFBhZ2UrKztcclxuICAgIHRoaXMubG9hZFBhZ2UoKTtcclxufTtcclxuXHJcblBhZ2luYXRpb25Db250cm9sbGVyLnByb3RvdHlwZS5vbkJ0UHJldmlvdXMgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY3VycmVudFBhZ2UtLTtcclxuICAgIHRoaXMubG9hZFBhZ2UoKTtcclxufTtcclxuXHJcblBhZ2luYXRpb25Db250cm9sbGVyLnByb3RvdHlwZS5vbkJ0Rmlyc3QgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuY3VycmVudFBhZ2UgPSAwO1xyXG4gICAgdGhpcy5sb2FkUGFnZSgpO1xyXG59O1xyXG5cclxuUGFnaW5hdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLm9uQnRMYXN0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmN1cnJlbnRQYWdlID0gdGhpcy50b3RhbFBhZ2VzIC0gMTtcclxuICAgIHRoaXMubG9hZFBhZ2UoKTtcclxufTtcclxuXHJcblBhZ2luYXRpb25Db250cm9sbGVyLnByb3RvdHlwZS5pc1plcm9QYWdlc1RvRGlzcGxheSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZm91bmRNYXhSb3cgJiYgdGhpcy50b3RhbFBhZ2VzID09PSAwO1xyXG59O1xyXG5cclxuUGFnaW5hdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLmVuYWJsZU9yRGlzYWJsZUJ1dHRvbnMgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBkaXNhYmxlUHJldmlvdXNBbmRGaXJzdCA9IHRoaXMuY3VycmVudFBhZ2UgPT09IDA7XHJcbiAgICB0aGlzLmJ0UHJldmlvdXMuZGlzYWJsZWQgPSBkaXNhYmxlUHJldmlvdXNBbmRGaXJzdDtcclxuICAgIHRoaXMuYnRGaXJzdC5kaXNhYmxlZCA9IGRpc2FibGVQcmV2aW91c0FuZEZpcnN0O1xyXG5cclxuICAgIHZhciB6ZXJvUGFnZXNUb0Rpc3BsYXkgPSB0aGlzLmlzWmVyb1BhZ2VzVG9EaXNwbGF5KCk7XHJcbiAgICB2YXIgb25MYXN0UGFnZSA9IHRoaXMuZm91bmRNYXhSb3cgJiYgdGhpcy5jdXJyZW50UGFnZSA9PT0gKHRoaXMudG90YWxQYWdlcyAtIDEpO1xyXG5cclxuICAgIHZhciBkaXNhYmxlTmV4dCA9IG9uTGFzdFBhZ2UgfHwgemVyb1BhZ2VzVG9EaXNwbGF5O1xyXG4gICAgdGhpcy5idE5leHQuZGlzYWJsZWQgPSBkaXNhYmxlTmV4dDtcclxuXHJcbiAgICB2YXIgZGlzYWJsZUxhc3QgPSAhdGhpcy5mb3VuZE1heFJvdyB8fCB6ZXJvUGFnZXNUb0Rpc3BsYXkgfHwgdGhpcy5jdXJyZW50UGFnZSA9PT0gKHRoaXMudG90YWxQYWdlcyAtIDEpO1xyXG4gICAgdGhpcy5idExhc3QuZGlzYWJsZWQgPSBkaXNhYmxlTGFzdDtcclxufTtcclxuXHJcblBhZ2luYXRpb25Db250cm9sbGVyLnByb3RvdHlwZS5wb3B1bGF0ZVBhbmVsID0gZnVuY3Rpb24oZVBhZ2luZ1BhbmVsKSB7XHJcblxyXG4gICAgZVBhZ2luZ1BhbmVsLmlubmVySFRNTCA9IFRFTVBMQVRFO1xyXG5cclxuICAgIHRoaXMuYnROZXh0ID0gZVBhZ2luZ1BhbmVsLnF1ZXJ5U2VsZWN0b3IoJyNidE5leHQnKTtcclxuICAgIHRoaXMuYnRQcmV2aW91cyA9IGVQYWdpbmdQYW5lbC5xdWVyeVNlbGVjdG9yKCcjYnRQcmV2aW91cycpO1xyXG4gICAgdGhpcy5idEZpcnN0ID0gZVBhZ2luZ1BhbmVsLnF1ZXJ5U2VsZWN0b3IoJyNidEZpcnN0Jyk7XHJcbiAgICB0aGlzLmJ0TGFzdCA9IGVQYWdpbmdQYW5lbC5xdWVyeVNlbGVjdG9yKCcjYnRMYXN0Jyk7XHJcbiAgICB0aGlzLmxiQ3VycmVudCA9IGVQYWdpbmdQYW5lbC5xdWVyeVNlbGVjdG9yKCcjY3VycmVudCcpO1xyXG4gICAgdGhpcy5sYlRvdGFsID0gZVBhZ2luZ1BhbmVsLnF1ZXJ5U2VsZWN0b3IoJyN0b3RhbCcpO1xyXG5cclxuICAgIHRoaXMubGJSZWNvcmRDb3VudCA9IGVQYWdpbmdQYW5lbC5xdWVyeVNlbGVjdG9yKCcjcmVjb3JkQ291bnQnKTtcclxuICAgIHRoaXMubGJGaXJzdFJvd09uUGFnZSA9IGVQYWdpbmdQYW5lbC5xdWVyeVNlbGVjdG9yKCcjZmlyc3RSb3dPblBhZ2UnKTtcclxuICAgIHRoaXMubGJMYXN0Um93T25QYWdlID0gZVBhZ2luZ1BhbmVsLnF1ZXJ5U2VsZWN0b3IoJyNsYXN0Um93T25QYWdlJyk7XHJcbiAgICB0aGlzLmVQYWdlUm93U3VtbWFyeVBhbmVsID0gZVBhZ2luZ1BhbmVsLnF1ZXJ5U2VsZWN0b3IoJyNwYWdlUm93U3VtbWFyeVBhbmVsJyk7XHJcblxyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuYnROZXh0LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhhdC5vbkJ0TmV4dCgpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5idFByZXZpb3VzLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhhdC5vbkJ0UHJldmlvdXMoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYnRGaXJzdC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoYXQub25CdEZpcnN0KCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmJ0TGFzdC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoYXQub25CdExhc3QoKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBQYWdpbmF0aW9uQ29udHJvbGxlcjtcclxuIiwidmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4vY29uc3RhbnRzJyk7XHJcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcclxudmFyIGdyb3VwQ2VsbFJlbmRlcmVyRmFjdG9yeSA9IHJlcXVpcmUoJy4vY2VsbFJlbmRlcmVycy9ncm91cENlbGxSZW5kZXJlckZhY3RvcnknKTtcclxuXHJcbnZhciBUQUJfS0VZID0gOTtcclxudmFyIEVOVEVSX0tFWSA9IDEzO1xyXG5cclxudmFyIERPV05fS0VZID0gNDA7XHJcbnZhciBVUF9LRVkgPSAzODtcclxudmFyIExFRlRfS0VZID0gMzc7XHJcbnZhciBSSUdIVF9LRVkgPSAzOTtcclxuXHJcbmZ1bmN0aW9uIFJvd1JlbmRlcmVyKCkge31cclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oZ3JpZE9wdGlvbnMsIGNvbHVtbk1vZGVsLCBncmlkT3B0aW9uc1dyYXBwZXIsIGVHcmlkLFxyXG4gICAgYW5ndWxhckdyaWQsIHNlbGVjdGlvblJlbmRlcmVyRmFjdG9yeSwgJGNvbXBpbGUsICRzY29wZSxcclxuICAgIHNlbGVjdGlvbkNvbnRyb2xsZXIsIGV4cHJlc3Npb25TZXJ2aWNlLCB0ZW1wbGF0ZVNlcnZpY2UsIGVQYXJlbnRPZlJvd3MpIHtcclxuICAgIHRoaXMuZ3JpZE9wdGlvbnMgPSBncmlkT3B0aW9ucztcclxuICAgIHRoaXMuY29sdW1uTW9kZWwgPSBjb2x1bW5Nb2RlbDtcclxuICAgIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyID0gZ3JpZE9wdGlvbnNXcmFwcGVyO1xyXG4gICAgdGhpcy5hbmd1bGFyR3JpZCA9IGFuZ3VsYXJHcmlkO1xyXG4gICAgdGhpcy5zZWxlY3Rpb25SZW5kZXJlckZhY3RvcnkgPSBzZWxlY3Rpb25SZW5kZXJlckZhY3Rvcnk7XHJcbiAgICB0aGlzLmZpbmRBbGxFbGVtZW50cyhlR3JpZCk7XHJcbiAgICB0aGlzLiRjb21waWxlID0gJGNvbXBpbGU7XHJcbiAgICB0aGlzLiRzY29wZSA9ICRzY29wZTtcclxuICAgIHRoaXMuc2VsZWN0aW9uQ29udHJvbGxlciA9IHNlbGVjdGlvbkNvbnRyb2xsZXI7XHJcbiAgICB0aGlzLmV4cHJlc3Npb25TZXJ2aWNlID0gZXhwcmVzc2lvblNlcnZpY2U7XHJcbiAgICB0aGlzLnRlbXBsYXRlU2VydmljZSA9IHRlbXBsYXRlU2VydmljZTtcclxuICAgIHRoaXMuZVBhcmVudE9mUm93cyA9IGVQYXJlbnRPZlJvd3M7XHJcblxyXG4gICAgdGhpcy5jZWxsUmVuZGVyZXJNYXAgPSB7XHJcbiAgICAgICAgJ2dyb3VwJzogZ3JvdXBDZWxsUmVuZGVyZXJGYWN0b3J5KGdyaWRPcHRpb25zV3JhcHBlciwgc2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5KVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBtYXAgb2Ygcm93IGlkcyB0byByb3cgb2JqZWN0cy4ga2VlcHMgdHJhY2sgb2Ygd2hpY2ggZWxlbWVudHNcclxuICAgIC8vIGFyZSByZW5kZXJlZCBmb3Igd2hpY2ggcm93cyBpbiB0aGUgZG9tLiBlYWNoIHJvdyBvYmplY3QgaGFzOlxyXG4gICAgLy8gW3Njb3BlLCBib2R5Um93LCBwaW5uZWRSb3csIHJvd0RhdGFdXHJcbiAgICB0aGlzLnJlbmRlcmVkUm93cyA9IHt9O1xyXG5cclxuICAgIHRoaXMucmVuZGVyZWRSb3dTdGFydEVkaXRpbmdMaXN0ZW5lcnMgPSB7fTtcclxuXHJcbiAgICB0aGlzLmVkaXRpbmdDZWxsID0gZmFsc2U7IC8vZ2V0cyBzZXQgdG8gdHJ1ZSB3aGVuIGVkaXRpbmcgYSBjZWxsXHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUuc2V0Um93TW9kZWwgPSBmdW5jdGlvbihyb3dNb2RlbCkge1xyXG4gICAgdGhpcy5yb3dNb2RlbCA9IHJvd01vZGVsO1xyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLnNldE1haW5Sb3dXaWR0aHMgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBtYWluUm93V2lkdGggPSB0aGlzLmNvbHVtbk1vZGVsLmdldEJvZHlDb250YWluZXJXaWR0aCgpICsgXCJweFwiO1xyXG5cclxuICAgIHZhciB1bnBpbm5lZFJvd3MgPSB0aGlzLmVCb2R5Q29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuYWctcm93XCIpO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1bnBpbm5lZFJvd3MubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB1bnBpbm5lZFJvd3NbaV0uc3R5bGUud2lkdGggPSBtYWluUm93V2lkdGg7XHJcbiAgICB9XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUuZmluZEFsbEVsZW1lbnRzID0gZnVuY3Rpb24oZUdyaWQpIHtcclxuICAgIGlmICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0RvbnRVc2VTY3JvbGxzKCkpIHtcclxuICAgICAgICB0aGlzLmVCb2R5Q29udGFpbmVyID0gZUdyaWQucXVlcnlTZWxlY3RvcihcIi5hZy1ib2R5LWNvbnRhaW5lclwiKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5lQm9keUNvbnRhaW5lciA9IGVHcmlkLnF1ZXJ5U2VsZWN0b3IoXCIuYWctYm9keS1jb250YWluZXJcIik7XHJcbiAgICAgICAgdGhpcy5lQm9keVZpZXdwb3J0ID0gZUdyaWQucXVlcnlTZWxlY3RvcihcIi5hZy1ib2R5LXZpZXdwb3J0XCIpO1xyXG4gICAgICAgIHRoaXMuZVBpbm5lZENvbHNDb250YWluZXIgPSBlR3JpZC5xdWVyeVNlbGVjdG9yKFwiLmFnLXBpbm5lZC1jb2xzLWNvbnRhaW5lclwiKTtcclxuICAgIH1cclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5yZWZyZXNoVmlldyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYgKCF0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0RvbnRVc2VTY3JvbGxzKCkpIHtcclxuICAgICAgICB2YXIgcm93Q291bnQgPSB0aGlzLnJvd01vZGVsLmdldFZpcnR1YWxSb3dDb3VudCgpO1xyXG4gICAgICAgIHZhciBjb250YWluZXJIZWlnaHQgPSB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRSb3dIZWlnaHQoKSAqIHJvd0NvdW50O1xyXG4gICAgICAgIHRoaXMuZUJvZHlDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gY29udGFpbmVySGVpZ2h0ICsgXCJweFwiO1xyXG4gICAgICAgIHRoaXMuZVBpbm5lZENvbHNDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gY29udGFpbmVySGVpZ2h0ICsgXCJweFwiO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucmVmcmVzaEFsbFZpcnR1YWxSb3dzKCk7XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUuc29mdFJlZnJlc2hWaWV3ID0gZnVuY3Rpb24oKSB7XHJcblxyXG4gICAgdmFyIGZpcnN0ID0gdGhpcy5maXJzdFZpcnR1YWxSZW5kZXJlZFJvdztcclxuICAgIHZhciBsYXN0ID0gdGhpcy5sYXN0VmlydHVhbFJlbmRlcmVkUm93O1xyXG5cclxuICAgIHZhciBjb2x1bW5zID0gdGhpcy5jb2x1bW5Nb2RlbC5nZXRWaXNpYmxlQ29sdW1ucygpO1xyXG4gICAgLy8gaWYgbm8gY29scywgZG9uJ3QgZHJhdyByb3dcclxuICAgIGlmICghY29sdW1ucyB8fCBjb2x1bW5zLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciByb3dJbmRleCA9IGZpcnN0OyByb3dJbmRleCA8PSBsYXN0OyByb3dJbmRleCsrKSB7XHJcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLnJvd01vZGVsLmdldFZpcnR1YWxSb3cocm93SW5kZXgpO1xyXG4gICAgICAgIGlmIChub2RlKSB7XHJcblxyXG4gICAgICAgICAgICBmb3IgKHZhciBjb2xJbmRleCA9IDA7IGNvbEluZGV4IDw9IGNvbHVtbnMubGVuZ3RoOyBjb2xJbmRleCsrKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgY29sdW1uID0gY29sdW1uc1tjb2xJbmRleF07XHJcbiAgICAgICAgICAgICAgICB2YXIgcmVuZGVyZWRSb3cgPSB0aGlzLnJlbmRlcmVkUm93c1tyb3dJbmRleF07XHJcbiAgICAgICAgICAgICAgICB2YXIgZUdyaWRDZWxsID0gcmVuZGVyZWRSb3cuZVZvbGF0aWxlQ2VsbHNbY29sSW5kZXhdO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghZUdyaWRDZWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGlzRmlyc3RDb2x1bW4gPSBjb2xJbmRleCA9PT0gMDtcclxuICAgICAgICAgICAgICAgIHZhciBzY29wZSA9IHJlbmRlcmVkUm93LnNjb3BlO1xyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuc29mdFJlZnJlc2hDZWxsKGVHcmlkQ2VsbCwgaXNGaXJzdENvbHVtbiwgbm9kZSwgY29sdW1uLCBzY29wZSwgcm93SW5kZXgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLnNvZnRSZWZyZXNoQ2VsbCA9IGZ1bmN0aW9uKGVHcmlkQ2VsbCwgaXNGaXJzdENvbHVtbiwgbm9kZSwgY29sdW1uLCBzY29wZSwgcm93SW5kZXgpIHtcclxuXHJcbiAgICB1dGlscy5yZW1vdmVBbGxDaGlsZHJlbihlR3JpZENlbGwpO1xyXG5cclxuICAgIHZhciBkYXRhID0gdGhpcy5nZXREYXRhRm9yTm9kZShub2RlKTtcclxuICAgIHZhciB2YWx1ZUdldHRlciA9IHRoaXMuY3JlYXRlVmFsdWVHZXR0ZXIoZGF0YSwgY29sdW1uLmNvbERlZiwgbm9kZSk7XHJcblxyXG4gICAgdmFyIHZhbHVlO1xyXG4gICAgaWYgKHZhbHVlR2V0dGVyKSB7XHJcbiAgICAgICAgdmFsdWUgPSB2YWx1ZUdldHRlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucG9wdWxhdGVBbmRTdHlsZUdyaWRDZWxsKHZhbHVlR2V0dGVyLCB2YWx1ZSwgZUdyaWRDZWxsLCBpc0ZpcnN0Q29sdW1uLCBub2RlLCBjb2x1bW4sIHJvd0luZGV4LCBzY29wZSk7XHJcblxyXG4gICAgLy8gaWYgYW5ndWxhciBjb21waWxpbmcsIHRoZW4gbmVlZCB0byBhbHNvIGNvbXBpbGUgdGhlIGNlbGwgYWdhaW4gKGFuZ3VsYXIgY29tcGlsaW5nIHN1Y2tzLCBwbGVhc2Ugd2FpdC4uLilcclxuICAgIGlmICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0FuZ3VsYXJDb21waWxlUm93cygpKSB7XHJcbiAgICAgICAgdGhpcy4kY29tcGlsZShlR3JpZENlbGwpKHNjb3BlKTtcclxuICAgIH1cclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5yb3dEYXRhQ2hhbmdlZCA9IGZ1bmN0aW9uKHJvd3MpIHtcclxuICAgIC8vIHdlIG9ubHkgbmVlZCB0byBiZSB3b3JyaWVkIGFib3V0IHJlbmRlcmVkIHJvd3MsIGFzIHRoaXMgbWV0aG9kIGlzXHJcbiAgICAvLyBjYWxsZWQgdG8gd2hhdHMgcmVuZGVyZWQuIGlmIHRoZSByb3cgaXNuJ3QgcmVuZGVyZWQsIHdlIGRvbid0IGNhcmVcclxuICAgIHZhciBpbmRleGVzVG9SZW1vdmUgPSBbXTtcclxuICAgIHZhciByZW5kZXJlZFJvd3MgPSB0aGlzLnJlbmRlcmVkUm93cztcclxuICAgIE9iamVjdC5rZXlzKHJlbmRlcmVkUm93cykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcclxuICAgICAgICB2YXIgcmVuZGVyZWRSb3cgPSByZW5kZXJlZFJvd3Nba2V5XTtcclxuICAgICAgICAvLyBzZWUgaWYgdGhlIHJlbmRlcmVkIHJvdyBpcyBpbiB0aGUgbGlzdCBvZiByb3dzIHdlIGhhdmUgdG8gdXBkYXRlXHJcbiAgICAgICAgdmFyIHJvd05lZWRzVXBkYXRpbmcgPSByb3dzLmluZGV4T2YocmVuZGVyZWRSb3cubm9kZS5kYXRhKSA+PSAwO1xyXG4gICAgICAgIGlmIChyb3dOZWVkc1VwZGF0aW5nKSB7XHJcbiAgICAgICAgICAgIGluZGV4ZXNUb1JlbW92ZS5wdXNoKGtleSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICAvLyByZW1vdmUgdGhlIHJvd3NcclxuICAgIHRoaXMucmVtb3ZlVmlydHVhbFJvd3MoaW5kZXhlc1RvUmVtb3ZlKTtcclxuICAgIC8vIGFkZCBkcmF3IHRoZW0gYWdhaW5cclxuICAgIHRoaXMuZHJhd1ZpcnR1YWxSb3dzKCk7XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUucmVmcmVzaEFsbFZpcnR1YWxSb3dzID0gZnVuY3Rpb24oKSB7XHJcbiAgICAvLyByZW1vdmUgYWxsIGN1cnJlbnQgdmlydHVhbCByb3dzLCBhcyB0aGV5IGhhdmUgb2xkIGRhdGFcclxuICAgIHZhciByb3dzVG9SZW1vdmUgPSBPYmplY3Qua2V5cyh0aGlzLnJlbmRlcmVkUm93cyk7XHJcbiAgICB0aGlzLnJlbW92ZVZpcnR1YWxSb3dzKHJvd3NUb1JlbW92ZSk7XHJcblxyXG4gICAgLy8gYWRkIGluIG5ldyByb3dzXHJcbiAgICB0aGlzLmRyYXdWaXJ0dWFsUm93cygpO1xyXG59O1xyXG5cclxuLy8gcHVibGljIC0gcmVtb3ZlcyB0aGUgZ3JvdXAgcm93cyBhbmQgdGhlbiByZWRyYXdzIHRoZW0gYWdhaW5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLnJlZnJlc2hHcm91cFJvd3MgPSBmdW5jdGlvbigpIHtcclxuICAgIC8vIGZpbmQgYWxsIHRoZSBncm91cCByb3dzXHJcbiAgICB2YXIgcm93c1RvUmVtb3ZlID0gW107XHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICBPYmplY3Qua2V5cyh0aGlzLnJlbmRlcmVkUm93cykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcclxuICAgICAgICB2YXIgcmVuZGVyZWRSb3cgPSB0aGF0LnJlbmRlcmVkUm93c1trZXldO1xyXG4gICAgICAgIHZhciBub2RlID0gcmVuZGVyZWRSb3cubm9kZTtcclxuICAgICAgICBpZiAobm9kZS5ncm91cCkge1xyXG4gICAgICAgICAgICByb3dzVG9SZW1vdmUucHVzaChrZXkpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgLy8gcmVtb3ZlIHRoZSByb3dzXHJcbiAgICB0aGlzLnJlbW92ZVZpcnR1YWxSb3dzKHJvd3NUb1JlbW92ZSk7XHJcbiAgICAvLyBhbmQgZHJhdyB0aGVtIGJhY2sgYWdhaW5cclxuICAgIHRoaXMuZW5zdXJlUm93c1JlbmRlcmVkKCk7XHJcbn07XHJcblxyXG4vLyB0YWtlcyBhcnJheSBvZiByb3cgaW5kZXhlc1xyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUucmVtb3ZlVmlydHVhbFJvd3MgPSBmdW5jdGlvbihyb3dzVG9SZW1vdmUpIHtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIHJvd3NUb1JlbW92ZS5mb3JFYWNoKGZ1bmN0aW9uKGluZGV4VG9SZW1vdmUpIHtcclxuICAgICAgICB0aGF0LnJlbW92ZVZpcnR1YWxSb3coaW5kZXhUb1JlbW92ZSk7XHJcbiAgICB9KTtcclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5yZW1vdmVWaXJ0dWFsUm93ID0gZnVuY3Rpb24oaW5kZXhUb1JlbW92ZSkge1xyXG4gICAgdmFyIHJlbmRlcmVkUm93ID0gdGhpcy5yZW5kZXJlZFJvd3NbaW5kZXhUb1JlbW92ZV07XHJcbiAgICBpZiAocmVuZGVyZWRSb3cucGlubmVkRWxlbWVudCAmJiB0aGlzLmVQaW5uZWRDb2xzQ29udGFpbmVyKSB7XHJcbiAgICAgICAgdGhpcy5lUGlubmVkQ29sc0NvbnRhaW5lci5yZW1vdmVDaGlsZChyZW5kZXJlZFJvdy5waW5uZWRFbGVtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAocmVuZGVyZWRSb3cuYm9keUVsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLmVCb2R5Q29udGFpbmVyLnJlbW92ZUNoaWxkKHJlbmRlcmVkUm93LmJvZHlFbGVtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAocmVuZGVyZWRSb3cuc2NvcGUpIHtcclxuICAgICAgICByZW5kZXJlZFJvdy5zY29wZS4kZGVzdHJveSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRWaXJ0dWFsUm93UmVtb3ZlZCgpKSB7XHJcbiAgICAgICAgdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0VmlydHVhbFJvd1JlbW92ZWQoKShyZW5kZXJlZFJvdy5kYXRhLCBpbmRleFRvUmVtb3ZlKTtcclxuICAgIH1cclxuICAgIHRoaXMuYW5ndWxhckdyaWQub25WaXJ0dWFsUm93UmVtb3ZlZChpbmRleFRvUmVtb3ZlKTtcclxuXHJcbiAgICBkZWxldGUgdGhpcy5yZW5kZXJlZFJvd3NbaW5kZXhUb1JlbW92ZV07XHJcbiAgICBkZWxldGUgdGhpcy5yZW5kZXJlZFJvd1N0YXJ0RWRpdGluZ0xpc3RlbmVyc1tpbmRleFRvUmVtb3ZlXTtcclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5kcmF3VmlydHVhbFJvd3MgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBmaXJzdDtcclxuICAgIHZhciBsYXN0O1xyXG5cclxuICAgIHZhciByb3dDb3VudCA9IHRoaXMucm93TW9kZWwuZ2V0VmlydHVhbFJvd0NvdW50KCk7XHJcblxyXG4gICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzRG9udFVzZVNjcm9sbHMoKSkge1xyXG4gICAgICAgIGZpcnN0ID0gMDtcclxuICAgICAgICBsYXN0ID0gcm93Q291bnQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHZhciB0b3BQaXhlbCA9IHRoaXMuZUJvZHlWaWV3cG9ydC5zY3JvbGxUb3A7XHJcbiAgICAgICAgdmFyIGJvdHRvbVBpeGVsID0gdG9wUGl4ZWwgKyB0aGlzLmVCb2R5Vmlld3BvcnQub2Zmc2V0SGVpZ2h0O1xyXG5cclxuICAgICAgICBmaXJzdCA9IE1hdGguZmxvb3IodG9wUGl4ZWwgLyB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRSb3dIZWlnaHQoKSk7XHJcbiAgICAgICAgbGFzdCA9IE1hdGguZmxvb3IoYm90dG9tUGl4ZWwgLyB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRSb3dIZWlnaHQoKSk7XHJcblxyXG4gICAgICAgIC8vYWRkIGluIGJ1ZmZlclxyXG4gICAgICAgIHZhciBidWZmZXIgPSB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRSb3dCdWZmZXIoKSB8fCBjb25zdGFudHMuUk9XX0JVRkZFUl9TSVpFO1xyXG4gICAgICAgIGZpcnN0ID0gZmlyc3QgLSBidWZmZXI7XHJcbiAgICAgICAgbGFzdCA9IGxhc3QgKyBidWZmZXI7XHJcblxyXG4gICAgICAgIC8vIGFkanVzdCwgaW4gY2FzZSBidWZmZXIgZXh0ZW5kZWQgYWN0dWFsIHNpemVcclxuICAgICAgICBpZiAoZmlyc3QgPCAwKSB7XHJcbiAgICAgICAgICAgIGZpcnN0ID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGxhc3QgPiByb3dDb3VudCAtIDEpIHtcclxuICAgICAgICAgICAgbGFzdCA9IHJvd0NvdW50IC0gMTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5maXJzdFZpcnR1YWxSZW5kZXJlZFJvdyA9IGZpcnN0O1xyXG4gICAgdGhpcy5sYXN0VmlydHVhbFJlbmRlcmVkUm93ID0gbGFzdDtcclxuXHJcbiAgICB0aGlzLmVuc3VyZVJvd3NSZW5kZXJlZCgpO1xyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLmdldEZpcnN0VmlydHVhbFJlbmRlcmVkUm93ID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5maXJzdFZpcnR1YWxSZW5kZXJlZFJvdztcclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5nZXRMYXN0VmlydHVhbFJlbmRlcmVkUm93ID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5sYXN0VmlydHVhbFJlbmRlcmVkUm93O1xyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLmVuc3VyZVJvd3NSZW5kZXJlZCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuICAgIHZhciBtYWluUm93V2lkdGggPSB0aGlzLmNvbHVtbk1vZGVsLmdldEJvZHlDb250YWluZXJXaWR0aCgpO1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG5cclxuICAgIC8vIGF0IHRoZSBlbmQsIHRoaXMgYXJyYXkgd2lsbCBjb250YWluIHRoZSBpdGVtcyB3ZSBuZWVkIHRvIHJlbW92ZVxyXG4gICAgdmFyIHJvd3NUb1JlbW92ZSA9IE9iamVjdC5rZXlzKHRoaXMucmVuZGVyZWRSb3dzKTtcclxuXHJcbiAgICAvLyBhZGQgaW4gbmV3IHJvd3NcclxuICAgIGZvciAodmFyIHJvd0luZGV4ID0gdGhpcy5maXJzdFZpcnR1YWxSZW5kZXJlZFJvdzsgcm93SW5kZXggPD0gdGhpcy5sYXN0VmlydHVhbFJlbmRlcmVkUm93OyByb3dJbmRleCsrKSB7XHJcbiAgICAgICAgLy8gc2VlIGlmIGl0ZW0gYWxyZWFkeSB0aGVyZSwgYW5kIGlmIHllcywgdGFrZSBpdCBvdXQgb2YgdGhlICd0byByZW1vdmUnIGFycmF5XHJcbiAgICAgICAgaWYgKHJvd3NUb1JlbW92ZS5pbmRleE9mKHJvd0luZGV4LnRvU3RyaW5nKCkpID49IDApIHtcclxuICAgICAgICAgICAgcm93c1RvUmVtb3ZlLnNwbGljZShyb3dzVG9SZW1vdmUuaW5kZXhPZihyb3dJbmRleC50b1N0cmluZygpKSwgMSk7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBjaGVjayB0aGlzIHJvdyBhY3R1YWxseSBleGlzdHMgKGluIGNhc2Ugb3ZlcmZsb3cgYnVmZmVyIHdpbmRvdyBleGNlZWRzIHJlYWwgZGF0YSlcclxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMucm93TW9kZWwuZ2V0VmlydHVhbFJvdyhyb3dJbmRleCk7XHJcbiAgICAgICAgaWYgKG5vZGUpIHtcclxuICAgICAgICAgICAgdGhhdC5pbnNlcnRSb3cobm9kZSwgcm93SW5kZXgsIG1haW5Sb3dXaWR0aCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIGF0IHRoaXMgcG9pbnQsIGV2ZXJ5dGhpbmcgaW4gb3VyICdyb3dzVG9SZW1vdmUnIC4gLiAuXHJcbiAgICB0aGlzLnJlbW92ZVZpcnR1YWxSb3dzKHJvd3NUb1JlbW92ZSk7XHJcblxyXG4gICAgLy8gaWYgd2UgYXJlIGRvaW5nIGFuZ3VsYXIgY29tcGlsaW5nLCB0aGVuIGRvIGRpZ2VzdCB0aGUgc2NvcGUgaGVyZVxyXG4gICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzQW5ndWxhckNvbXBpbGVSb3dzKCkpIHtcclxuICAgICAgICAvLyB3ZSBkbyBpdCBpbiBhIHRpbWVvdXQsIGluIGNhc2Ugd2UgYXJlIGFscmVhZHkgaW4gYW4gYXBwbHlcclxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGF0LiRzY29wZS4kYXBwbHkoKTtcclxuICAgICAgICB9LCAwKTtcclxuICAgIH1cclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5pbnNlcnRSb3cgPSBmdW5jdGlvbihub2RlLCByb3dJbmRleCwgbWFpblJvd1dpZHRoKSB7XHJcbiAgICB2YXIgY29sdW1ucyA9IHRoaXMuY29sdW1uTW9kZWwuZ2V0VmlzaWJsZUNvbHVtbnMoKTtcclxuICAgIC8vIGlmIG5vIGNvbHMsIGRvbid0IGRyYXcgcm93XHJcbiAgICBpZiAoIWNvbHVtbnMgfHwgY29sdW1ucy5sZW5ndGggPT0gMCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyB2YXIgcm93RGF0YSA9IG5vZGUucm93RGF0YTtcclxuICAgIHZhciByb3dJc0FHcm91cCA9IG5vZGUuZ3JvdXA7XHJcbiAgICB2YXIgcm93SXNBRm9vdGVyID0gbm9kZS5mb290ZXI7XHJcblxyXG4gICAgLy8gdHJ5IGNvbXBpbGluZyBhcyB3ZSBpbnNlcnQgcm93c1xyXG4gICAgdmFyIG5ld0NoaWxkU2NvcGUgPSB0aGlzLmNyZWF0ZUNoaWxkU2NvcGVPck51bGwobm9kZS5kYXRhKTtcclxuXHJcbiAgICB2YXIgZVBpbm5lZFJvdyA9IHRoaXMuY3JlYXRlUm93Q29udGFpbmVyKHJvd0luZGV4LCBub2RlLCByb3dJc0FHcm91cCwgbmV3Q2hpbGRTY29wZSk7XHJcbiAgICB2YXIgZU1haW5Sb3cgPSB0aGlzLmNyZWF0ZVJvd0NvbnRhaW5lcihyb3dJbmRleCwgbm9kZSwgcm93SXNBR3JvdXAsIG5ld0NoaWxkU2NvcGUpO1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG5cclxuICAgIGVNYWluUm93LnN0eWxlLndpZHRoID0gbWFpblJvd1dpZHRoICsgXCJweFwiO1xyXG5cclxuICAgIHZhciByZW5kZXJlZFJvdyA9IHtcclxuICAgICAgICBzY29wZTogbmV3Q2hpbGRTY29wZSxcclxuICAgICAgICBub2RlOiBub2RlLFxyXG4gICAgICAgIHJvd0luZGV4OiByb3dJbmRleCxcclxuICAgICAgICBlQ2VsbHM6IHt9LFxyXG4gICAgICAgIGVWb2xhdGlsZUNlbGxzOiB7fVxyXG4gICAgfTtcclxuICAgIHRoaXMucmVuZGVyZWRSb3dzW3Jvd0luZGV4XSA9IHJlbmRlcmVkUm93O1xyXG4gICAgdGhpcy5yZW5kZXJlZFJvd1N0YXJ0RWRpdGluZ0xpc3RlbmVyc1tyb3dJbmRleF0gPSB7fTtcclxuXHJcbiAgICAvLyBpZiBncm91cCBpdGVtLCBpbnNlcnQgdGhlIGZpcnN0IHJvd1xyXG4gICAgdmFyIGdyb3VwSGVhZGVyVGFrZXNFbnRpcmVSb3cgPSB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0dyb3VwVXNlRW50aXJlUm93KCk7XHJcbiAgICB2YXIgZHJhd0dyb3VwUm93ID0gcm93SXNBR3JvdXAgJiYgZ3JvdXBIZWFkZXJUYWtlc0VudGlyZVJvdztcclxuXHJcbiAgICBpZiAoZHJhd0dyb3VwUm93KSB7XHJcbiAgICAgICAgdmFyIGZpcnN0Q29sdW1uID0gY29sdW1uc1swXTtcclxuXHJcbiAgICAgICAgdmFyIGVHcm91cFJvdyA9IHRoYXQuY3JlYXRlR3JvdXBFbGVtZW50KG5vZGUsIGZhbHNlKTtcclxuICAgICAgICBpZiAoZmlyc3RDb2x1bW4ucGlubmVkKSB7XHJcbiAgICAgICAgICAgIGVQaW5uZWRSb3cuYXBwZW5kQ2hpbGQoZUdyb3VwUm93KTtcclxuXHJcbiAgICAgICAgICAgIHZhciBlR3JvdXBSb3dQYWRkaW5nID0gdGhhdC5jcmVhdGVHcm91cEVsZW1lbnQobm9kZSwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIGVNYWluUm93LmFwcGVuZENoaWxkKGVHcm91cFJvd1BhZGRpbmcpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGVNYWluUm93LmFwcGVuZENoaWxkKGVHcm91cFJvdyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL3JlbmRlcmVkUm93LmVDZWxsc1tmaXJzdENvbHVtbi5jb2xLZXldID0gZUdyb3VwUm93O1xyXG5cclxuICAgIH0gZWxzZSB7XHJcblxyXG4gICAgICAgIGNvbHVtbnMuZm9yRWFjaChmdW5jdGlvbihjb2x1bW4sIGluZGV4KSB7XHJcbiAgICAgICAgICAgIHZhciBmaXJzdENvbCA9IGluZGV4ID09PSAwO1xyXG4gICAgICAgICAgICB2YXIgZGF0YSA9IHRoYXQuZ2V0RGF0YUZvck5vZGUobm9kZSk7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZUdldHRlciA9IHRoYXQuY3JlYXRlVmFsdWVHZXR0ZXIoZGF0YSwgY29sdW1uLmNvbERlZiwgbm9kZSk7XHJcbiAgICAgICAgICAgIHRoYXQuY3JlYXRlQ2VsbEZyb21Db2xEZWYoZmlyc3RDb2wsIGNvbHVtbiwgdmFsdWVHZXR0ZXIsIG5vZGUsIHJvd0luZGV4LCBlTWFpblJvdywgZVBpbm5lZFJvdywgbmV3Q2hpbGRTY29wZSwgcmVuZGVyZWRSb3cpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vdHJ5IGNvbXBpbGluZyBhcyB3ZSBpbnNlcnQgcm93c1xyXG4gICAgcmVuZGVyZWRSb3cucGlubmVkRWxlbWVudCA9IHRoaXMuY29tcGlsZUFuZEFkZCh0aGlzLmVQaW5uZWRDb2xzQ29udGFpbmVyLCByb3dJbmRleCwgZVBpbm5lZFJvdywgbmV3Q2hpbGRTY29wZSk7XHJcbiAgICByZW5kZXJlZFJvdy5ib2R5RWxlbWVudCA9IHRoaXMuY29tcGlsZUFuZEFkZCh0aGlzLmVCb2R5Q29udGFpbmVyLCByb3dJbmRleCwgZU1haW5Sb3csIG5ld0NoaWxkU2NvcGUpO1xyXG59O1xyXG5cclxuLy8gaWYgZ3JvdXAgaXMgYSBmb290ZXIsIGFsd2F5cyBzaG93IHRoZSBkYXRhLlxyXG4vLyBpZiBncm91cCBpcyBhIGhlYWRlciwgb25seSBzaG93IGRhdGEgaWYgbm90IGV4cGFuZGVkXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5nZXREYXRhRm9yTm9kZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgIGlmIChub2RlLmZvb3Rlcikge1xyXG4gICAgICAgIC8vIGlmIGZvb3Rlciwgd2UgYWx3YXlzIHNob3cgdGhlIGRhdGFcclxuICAgICAgICByZXR1cm4gbm9kZS5kYXRhO1xyXG4gICAgfSBlbHNlIGlmIChub2RlLmdyb3VwKSB7XHJcbiAgICAgICAgLy8gaWYgaGVhZGVyIGFuZCBoZWFkZXIgaXMgZXhwYW5kZWQsIHdlIHNob3cgZGF0YSBpbiBmb290ZXIgb25seVxyXG4gICAgICAgIHZhciBmb290ZXJzRW5hYmxlZCA9IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmlzR3JvdXBJbmNsdWRlRm9vdGVyKCk7XHJcbiAgICAgICAgcmV0dXJuIChub2RlLmV4cGFuZGVkICYmIGZvb3RlcnNFbmFibGVkKSA/IHVuZGVmaW5lZCA6IG5vZGUuZGF0YTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gb3RoZXJ3aXNlIGl0J3MgYSBub3JtYWwgbm9kZSwganVzdCByZXR1cm4gZGF0YSBhcyBub3JtYWxcclxuICAgICAgICByZXR1cm4gbm9kZS5kYXRhO1xyXG4gICAgfVxyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLmNyZWF0ZVZhbHVlR2V0dGVyID0gZnVuY3Rpb24oZGF0YSwgY29sRGVmLCBub2RlKSB7XHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGFwaSA9IHRoYXQuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldEFwaSgpO1xyXG4gICAgICAgIHZhciBjb250ZXh0ID0gdGhhdC5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0Q29udGV4dCgpO1xyXG4gICAgICAgIHJldHVybiB1dGlscy5nZXRWYWx1ZSh0aGF0LmV4cHJlc3Npb25TZXJ2aWNlLCBkYXRhLCBjb2xEZWYsIG5vZGUsIGFwaSwgY29udGV4dCk7XHJcbiAgICB9O1xyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLmNyZWF0ZUNoaWxkU2NvcGVPck51bGwgPSBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICBpZiAodGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNBbmd1bGFyQ29tcGlsZVJvd3MoKSkge1xyXG4gICAgICAgIHZhciBuZXdDaGlsZFNjb3BlID0gdGhpcy4kc2NvcGUuJG5ldygpO1xyXG4gICAgICAgIG5ld0NoaWxkU2NvcGUuZGF0YSA9IGRhdGE7XHJcbiAgICAgICAgcmV0dXJuIG5ld0NoaWxkU2NvcGU7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLmNvbXBpbGVBbmRBZGQgPSBmdW5jdGlvbihjb250YWluZXIsIHJvd0luZGV4LCBlbGVtZW50LCBzY29wZSkge1xyXG4gICAgaWYgKHNjb3BlKSB7XHJcbiAgICAgICAgdmFyIGVFbGVtZW50Q29tcGlsZWQgPSB0aGlzLiRjb21waWxlKGVsZW1lbnQpKHNjb3BlKTtcclxuICAgICAgICBpZiAoY29udGFpbmVyKSB7IC8vIGNoZWNraW5nIGNvbnRhaW5lciwgYXMgaWYgbm9TY3JvbGwsIHBpbm5lZCBjb250YWluZXIgaXMgbWlzc2luZ1xyXG4gICAgICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoZUVsZW1lbnRDb21waWxlZFswXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBlRWxlbWVudENvbXBpbGVkWzBdO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBpZiAoY29udGFpbmVyKSB7XHJcbiAgICAgICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChlbGVtZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XHJcbiAgICB9XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUuY3JlYXRlQ2VsbEZyb21Db2xEZWYgPSBmdW5jdGlvbihpc0ZpcnN0Q29sdW1uLCBjb2x1bW4sIHZhbHVlR2V0dGVyLCBub2RlLCByb3dJbmRleCwgZU1haW5Sb3csIGVQaW5uZWRSb3csICRjaGlsZFNjb3BlLCByZW5kZXJlZFJvdykge1xyXG4gICAgdmFyIGVHcmlkQ2VsbCA9IHRoaXMuY3JlYXRlQ2VsbChpc0ZpcnN0Q29sdW1uLCBjb2x1bW4sIHZhbHVlR2V0dGVyLCBub2RlLCByb3dJbmRleCwgJGNoaWxkU2NvcGUpO1xyXG5cclxuICAgIGlmIChjb2x1bW4uY29sRGVmLnZvbGF0aWxlKSB7XHJcbiAgICAgICAgcmVuZGVyZWRSb3cuZVZvbGF0aWxlQ2VsbHNbY29sdW1uLmNvbEtleV0gPSBlR3JpZENlbGw7XHJcbiAgICB9XHJcbiAgICByZW5kZXJlZFJvdy5lQ2VsbHNbY29sdW1uLmNvbEtleV0gPSBlR3JpZENlbGw7XHJcblxyXG4gICAgaWYgKGNvbHVtbi5waW5uZWQpIHtcclxuICAgICAgICBlUGlubmVkUm93LmFwcGVuZENoaWxkKGVHcmlkQ2VsbCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGVNYWluUm93LmFwcGVuZENoaWxkKGVHcmlkQ2VsbCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUuYWRkQ2xhc3Nlc1RvUm93ID0gZnVuY3Rpb24ocm93SW5kZXgsIG5vZGUsIGVSb3cpIHtcclxuICAgIHZhciBjbGFzc2VzTGlzdCA9IFtcImFnLXJvd1wiXTtcclxuICAgIGNsYXNzZXNMaXN0LnB1c2gocm93SW5kZXggJSAyID09IDAgPyBcImFnLXJvdy1ldmVuXCIgOiBcImFnLXJvdy1vZGRcIik7XHJcblxyXG4gICAgaWYgKHRoaXMuc2VsZWN0aW9uQ29udHJvbGxlci5pc05vZGVTZWxlY3RlZChub2RlKSkge1xyXG4gICAgICAgIGNsYXNzZXNMaXN0LnB1c2goXCJhZy1yb3ctc2VsZWN0ZWRcIik7XHJcbiAgICB9XHJcbiAgICBpZiAobm9kZS5ncm91cCkge1xyXG4gICAgICAgIC8vIGlmIGEgZ3JvdXAsIHB1dCB0aGUgbGV2ZWwgb2YgdGhlIGdyb3VwIGluXHJcbiAgICAgICAgY2xhc3Nlc0xpc3QucHVzaChcImFnLXJvdy1sZXZlbC1cIiArIG5vZGUubGV2ZWwpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBpZiBhIGxlYWYsIGFuZCBhIHBhcmVudCBleGlzdHMsIHB1dCBhIGxldmVsIG9mIHRoZSBwYXJlbnQsIGVsc2UgcHV0IGxldmVsIG9mIDAgZm9yIHRvcCBsZXZlbCBpdGVtXHJcbiAgICAgICAgaWYgKG5vZGUucGFyZW50KSB7XHJcbiAgICAgICAgICAgIGNsYXNzZXNMaXN0LnB1c2goXCJhZy1yb3ctbGV2ZWwtXCIgKyAobm9kZS5wYXJlbnQubGV2ZWwgKyAxKSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY2xhc3Nlc0xpc3QucHVzaChcImFnLXJvdy1sZXZlbC0wXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmIChub2RlLmdyb3VwKSB7XHJcbiAgICAgICAgY2xhc3Nlc0xpc3QucHVzaChcImFnLXJvdy1ncm91cFwiKTtcclxuICAgIH1cclxuICAgIGlmIChub2RlLmdyb3VwICYmICFub2RlLmZvb3RlciAmJiBub2RlLmV4cGFuZGVkKSB7XHJcbiAgICAgICAgY2xhc3Nlc0xpc3QucHVzaChcImFnLXJvdy1ncm91cC1leHBhbmRlZFwiKTtcclxuICAgIH1cclxuICAgIGlmIChub2RlLmdyb3VwICYmICFub2RlLmZvb3RlciAmJiAhbm9kZS5leHBhbmRlZCkge1xyXG4gICAgICAgIC8vIG9wcG9zaXRlIG9mIGV4cGFuZGVkIGlzIGNvbnRyYWN0ZWQgYWNjb3JkaW5nIHRvIHRoZSBpbnRlcm5ldC5cclxuICAgICAgICBjbGFzc2VzTGlzdC5wdXNoKFwiYWctcm93LWdyb3VwLWNvbnRyYWN0ZWRcIik7XHJcbiAgICB9XHJcbiAgICBpZiAobm9kZS5ncm91cCAmJiBub2RlLmZvb3Rlcikge1xyXG4gICAgICAgIGNsYXNzZXNMaXN0LnB1c2goXCJhZy1yb3ctZm9vdGVyXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGFkZCBpbiBleHRyYSBjbGFzc2VzIHByb3ZpZGVkIGJ5IHRoZSBjb25maWdcclxuICAgIGlmICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRSb3dDbGFzcygpKSB7XHJcbiAgICAgICAgdmFyIHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgbm9kZTogbm9kZSxcclxuICAgICAgICAgICAgZGF0YTogbm9kZS5kYXRhLFxyXG4gICAgICAgICAgICByb3dJbmRleDogcm93SW5kZXgsXHJcbiAgICAgICAgICAgIGNvbnRleHQ6IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldENvbnRleHQoKSxcclxuICAgICAgICAgICAgYXBpOiB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRBcGkoKVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgdmFyIGV4dHJhUm93Q2xhc3NlcyA9IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldFJvd0NsYXNzKCkocGFyYW1zKTtcclxuICAgICAgICBpZiAoZXh0cmFSb3dDbGFzc2VzKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZXh0cmFSb3dDbGFzc2VzID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgY2xhc3Nlc0xpc3QucHVzaChleHRyYVJvd0NsYXNzZXMpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZXh0cmFSb3dDbGFzc2VzKSkge1xyXG4gICAgICAgICAgICAgICAgZXh0cmFSb3dDbGFzc2VzLmZvckVhY2goZnVuY3Rpb24oY2xhc3NJdGVtKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3Nlc0xpc3QucHVzaChjbGFzc0l0ZW0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGNsYXNzZXMgPSBjbGFzc2VzTGlzdC5qb2luKFwiIFwiKTtcclxuXHJcbiAgICBlUm93LmNsYXNzTmFtZSA9IGNsYXNzZXM7XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUuY3JlYXRlUm93Q29udGFpbmVyID0gZnVuY3Rpb24ocm93SW5kZXgsIG5vZGUsIGdyb3VwUm93LCAkc2NvcGUpIHtcclxuICAgIHZhciBlUm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHJcbiAgICB0aGlzLmFkZENsYXNzZXNUb1Jvdyhyb3dJbmRleCwgbm9kZSwgZVJvdyk7XHJcblxyXG4gICAgZVJvdy5zZXRBdHRyaWJ1dGUoJ3JvdycsIHJvd0luZGV4KTtcclxuXHJcbiAgICAvLyBpZiBzaG93aW5nIHNjcm9sbHMsIHBvc2l0aW9uIG9uIHRoZSBjb250YWluZXJcclxuICAgIGlmICghdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNEb250VXNlU2Nyb2xscygpKSB7XHJcbiAgICAgICAgZVJvdy5zdHlsZS50b3AgPSAodGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0Um93SGVpZ2h0KCkgKiByb3dJbmRleCkgKyBcInB4XCI7XHJcbiAgICB9XHJcbiAgICBlUm93LnN0eWxlLmhlaWdodCA9ICh0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRSb3dIZWlnaHQoKSkgKyBcInB4XCI7XHJcblxyXG4gICAgaWYgKHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldFJvd1N0eWxlKCkpIHtcclxuICAgICAgICB2YXIgY3NzVG9Vc2U7XHJcbiAgICAgICAgdmFyIHJvd1N0eWxlID0gdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0Um93U3R5bGUoKTtcclxuICAgICAgICBpZiAodHlwZW9mIHJvd1N0eWxlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgICAgICBkYXRhOiBub2RlLmRhdGEsXHJcbiAgICAgICAgICAgICAgICBub2RlOiBub2RlLFxyXG4gICAgICAgICAgICAgICAgYXBpOiB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRBcGkoKSxcclxuICAgICAgICAgICAgICAgIGNvbnRleHQ6IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldENvbnRleHQoKSxcclxuICAgICAgICAgICAgICAgICRzY29wZTogJHNjb3BlXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGNzc1RvVXNlID0gcm93U3R5bGUocGFyYW1zKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjc3NUb1VzZSA9IHJvd1N0eWxlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNzc1RvVXNlKSB7XHJcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGNzc1RvVXNlKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xyXG4gICAgICAgICAgICAgICAgZVJvdy5zdHlsZVtrZXldID0gY3NzVG9Vc2Vba2V5XTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICBlUm93LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbihldmVudCkge1xyXG4gICAgICAgIF90aGlzLmFuZ3VsYXJHcmlkLm9uUm93Q2xpY2tlZChldmVudCwgTnVtYmVyKHRoaXMuZ2V0QXR0cmlidXRlKFwicm93XCIpKSwgbm9kZSlcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBlUm93O1xyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLmdldEluZGV4T2ZSZW5kZXJlZE5vZGUgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICB2YXIgcmVuZGVyZWRSb3dzID0gdGhpcy5yZW5kZXJlZFJvd3M7XHJcbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHJlbmRlcmVkUm93cyk7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBpZiAocmVuZGVyZWRSb3dzW2tleXNbaV1dLm5vZGUgPT09IG5vZGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlbmRlcmVkUm93c1trZXlzW2ldXS5yb3dJbmRleDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gLTE7XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUuY3JlYXRlR3JvdXBFbGVtZW50ID0gZnVuY3Rpb24obm9kZSwgcGFkZGluZykge1xyXG4gICAgdmFyIGVSb3c7XHJcbiAgICBpZiAocGFkZGluZykge1xyXG4gICAgICAgIGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHZhciBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIG5vZGU6IG5vZGUsXHJcbiAgICAgICAgICAgIGRhdGE6IG5vZGUuZGF0YSxcclxuICAgICAgICAgICAgcm93SW5kZXg6IDQsXHJcbiAgICAgICAgICAgIGFwaTogdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0QXBpKCksXHJcbiAgICAgICAgICAgIGNvbERlZjoge1xyXG4gICAgICAgICAgICAgICAgY2VsbFJlbmRlcmVyOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVuZGVyZXI6ICdncm91cCcsXHJcbiAgICAgICAgICAgICAgICAgICAgaW5uZXJSZW5kZXJlcjogdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0R3JvdXBJbm5lclJlbmRlcmVyKClcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgZVJvdyA9IHRoaXMuY2VsbFJlbmRlcmVyTWFwWydncm91cCddKHBhcmFtcyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG5vZGUuZm9vdGVyKSB7XHJcbiAgICAgICAgdXRpbHMuYWRkQ3NzQ2xhc3MoZVJvdywgJ2FnLWZvb3Rlci1jZWxsLWVudGlyZS1yb3cnKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdXRpbHMuYWRkQ3NzQ2xhc3MoZVJvdywgJ2FnLWdyb3VwLWNlbGwtZW50aXJlLXJvdycpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBlUm93O1xyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLnB1dERhdGFJbnRvQ2VsbCA9IGZ1bmN0aW9uKGNvbHVtbiwgdmFsdWUsIHZhbHVlR2V0dGVyLCBub2RlLCAkY2hpbGRTY29wZSwgZUdyaWRDZWxsLCByb3dJbmRleCwgcmVmcmVzaENlbGxGdW5jdGlvbikge1xyXG4gICAgLy8gdGVtcGxhdGUgZ2V0cyBwcmVmZXJlbmNlLCB0aGVuIGNlbGxSZW5kZXJlciwgdGhlbiBkbyBpdCBvdXJzZWx2ZXNcclxuICAgIHZhciBjb2xEZWYgPSBjb2x1bW4uY29sRGVmO1xyXG4gICAgaWYgKGNvbERlZi50ZW1wbGF0ZSkge1xyXG4gICAgICAgIGVHcmlkQ2VsbC5pbm5lckhUTUwgPSBjb2xEZWYudGVtcGxhdGU7XHJcbiAgICB9IGVsc2UgaWYgKGNvbERlZi50ZW1wbGF0ZVVybCkge1xyXG4gICAgICAgIHZhciB0ZW1wbGF0ZSA9IHRoaXMudGVtcGxhdGVTZXJ2aWNlLmdldFRlbXBsYXRlKGNvbERlZi50ZW1wbGF0ZVVybCwgcmVmcmVzaENlbGxGdW5jdGlvbik7XHJcbiAgICAgICAgaWYgKHRlbXBsYXRlKSB7XHJcbiAgICAgICAgICAgIGVHcmlkQ2VsbC5pbm5lckhUTUwgPSB0ZW1wbGF0ZTtcclxuICAgICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKGNvbERlZi5jZWxsUmVuZGVyZXIpIHtcclxuICAgICAgICB0aGlzLnVzZUNlbGxSZW5kZXJlcihjb2x1bW4sIHZhbHVlLCBub2RlLCAkY2hpbGRTY29wZSwgZUdyaWRDZWxsLCByb3dJbmRleCwgcmVmcmVzaENlbGxGdW5jdGlvbiwgdmFsdWVHZXR0ZXIpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBpZiB3ZSBpbnNlcnQgdW5kZWZpbmVkLCB0aGVuIGl0IGRpc3BsYXlzIGFzIHRoZSBzdHJpbmcgJ3VuZGVmaW5lZCcsIHVnbHkhXHJcbiAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09ICcnKSB7XHJcbiAgICAgICAgICAgIGVHcmlkQ2VsbC5pbm5lckhUTUwgPSB2YWx1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUudXNlQ2VsbFJlbmRlcmVyID0gZnVuY3Rpb24oY29sdW1uLCB2YWx1ZSwgbm9kZSwgJGNoaWxkU2NvcGUsIGVHcmlkQ2VsbCwgcm93SW5kZXgsIHJlZnJlc2hDZWxsRnVuY3Rpb24sIHZhbHVlR2V0dGVyKSB7XHJcbiAgICB2YXIgY29sRGVmID0gY29sdW1uLmNvbERlZjtcclxuICAgIHZhciByZW5kZXJlclBhcmFtcyA9IHtcclxuICAgICAgICB2YWx1ZTogdmFsdWUsXHJcbiAgICAgICAgdmFsdWVHZXR0ZXI6IHZhbHVlR2V0dGVyLFxyXG4gICAgICAgIGRhdGE6IG5vZGUuZGF0YSxcclxuICAgICAgICBub2RlOiBub2RlLFxyXG4gICAgICAgIGNvbERlZjogY29sRGVmLFxyXG4gICAgICAgIGNvbHVtbjogY29sdW1uLFxyXG4gICAgICAgICRzY29wZTogJGNoaWxkU2NvcGUsXHJcbiAgICAgICAgcm93SW5kZXg6IHJvd0luZGV4LFxyXG4gICAgICAgIGFwaTogdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0QXBpKCksXHJcbiAgICAgICAgY29udGV4dDogdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0Q29udGV4dCgpLFxyXG4gICAgICAgIHJlZnJlc2hDZWxsOiByZWZyZXNoQ2VsbEZ1bmN0aW9uXHJcbiAgICB9O1xyXG4gICAgdmFyIGNlbGxSZW5kZXJlcjtcclxuICAgIGlmICh0eXBlb2YgY29sRGVmLmNlbGxSZW5kZXJlciA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICBjZWxsUmVuZGVyZXIgPSB0aGlzLmNlbGxSZW5kZXJlck1hcFtjb2xEZWYuY2VsbFJlbmRlcmVyLnJlbmRlcmVyXTtcclxuICAgICAgICBpZiAoIWNlbGxSZW5kZXJlcikge1xyXG4gICAgICAgICAgICB0aHJvdyAnQ2VsbCByZW5kZXJlciAnICsgY29sRGVmLmNlbGxSZW5kZXJlciArICcgbm90IGZvdW5kLCBhdmFpbGFibGUgYXJlICcgKyBPYmplY3Qua2V5cyh0aGlzLmNlbGxSZW5kZXJlck1hcCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY29sRGVmLmNlbGxSZW5kZXJlciA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIGNlbGxSZW5kZXJlciA9IGNvbERlZi5jZWxsUmVuZGVyZXI7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRocm93ICdDZWxsIFJlbmRlcmVyIG11c3QgYmUgU3RyaW5nIG9yIEZ1bmN0aW9uJztcclxuICAgIH1cclxuICAgIHZhciByZXN1bHRGcm9tUmVuZGVyZXIgPSBjZWxsUmVuZGVyZXIocmVuZGVyZXJQYXJhbXMpO1xyXG4gICAgaWYgKHV0aWxzLmlzTm9kZU9yRWxlbWVudChyZXN1bHRGcm9tUmVuZGVyZXIpKSB7XHJcbiAgICAgICAgLy8gYSBkb20gbm9kZSBvciBlbGVtZW50IHdhcyByZXR1cm5lZCwgc28gYWRkIGNoaWxkXHJcbiAgICAgICAgZUdyaWRDZWxsLmFwcGVuZENoaWxkKHJlc3VsdEZyb21SZW5kZXJlcik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIG90aGVyd2lzZSBhc3N1bWUgaXQgd2FzIGh0bWwsIHNvIGp1c3QgaW5zZXJ0XHJcbiAgICAgICAgZUdyaWRDZWxsLmlubmVySFRNTCA9IHJlc3VsdEZyb21SZW5kZXJlcjtcclxuICAgIH1cclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5hZGRTdHlsZXNGcm9tQ29sbERlZiA9IGZ1bmN0aW9uKGNvbHVtbiwgdmFsdWUsIG5vZGUsICRjaGlsZFNjb3BlLCBlR3JpZENlbGwpIHtcclxuICAgIHZhciBjb2xEZWYgPSBjb2x1bW4uY29sRGVmO1xyXG4gICAgaWYgKGNvbERlZi5jZWxsU3R5bGUpIHtcclxuICAgICAgICB2YXIgY3NzVG9Vc2U7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBjb2xEZWYuY2VsbFN0eWxlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHZhciBjZWxsU3R5bGVQYXJhbXMgPSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiBub2RlLmRhdGEsXHJcbiAgICAgICAgICAgICAgICBub2RlOiBub2RlLFxyXG4gICAgICAgICAgICAgICAgY29sRGVmOiBjb2xEZWYsXHJcbiAgICAgICAgICAgICAgICBjb2x1bW46IGNvbHVtbixcclxuICAgICAgICAgICAgICAgICRzY29wZTogJGNoaWxkU2NvcGUsXHJcbiAgICAgICAgICAgICAgICBjb250ZXh0OiB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRDb250ZXh0KCksXHJcbiAgICAgICAgICAgICAgICBhcGk6IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldEFwaSgpXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGNzc1RvVXNlID0gY29sRGVmLmNlbGxTdHlsZShjZWxsU3R5bGVQYXJhbXMpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNzc1RvVXNlID0gY29sRGVmLmNlbGxTdHlsZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjc3NUb1VzZSkge1xyXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhjc3NUb1VzZSkuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcclxuICAgICAgICAgICAgICAgIGVHcmlkQ2VsbC5zdHlsZVtrZXldID0gY3NzVG9Vc2Vba2V5XTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLmFkZENsYXNzZXNGcm9tQ29sbERlZiA9IGZ1bmN0aW9uKGNvbERlZiwgdmFsdWUsIG5vZGUsICRjaGlsZFNjb3BlLCBlR3JpZENlbGwpIHtcclxuICAgIGlmIChjb2xEZWYuY2VsbENsYXNzKSB7XHJcbiAgICAgICAgdmFyIGNsYXNzVG9Vc2U7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBjb2xEZWYuY2VsbENsYXNzID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHZhciBjZWxsQ2xhc3NQYXJhbXMgPSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiBub2RlLmRhdGEsXHJcbiAgICAgICAgICAgICAgICBub2RlOiBub2RlLFxyXG4gICAgICAgICAgICAgICAgY29sRGVmOiBjb2xEZWYsXHJcbiAgICAgICAgICAgICAgICAkc2NvcGU6ICRjaGlsZFNjb3BlLFxyXG4gICAgICAgICAgICAgICAgY29udGV4dDogdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0Q29udGV4dCgpLFxyXG4gICAgICAgICAgICAgICAgYXBpOiB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRBcGkoKVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBjbGFzc1RvVXNlID0gY29sRGVmLmNlbGxDbGFzcyhjZWxsQ2xhc3NQYXJhbXMpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNsYXNzVG9Vc2UgPSBjb2xEZWYuY2VsbENsYXNzO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHR5cGVvZiBjbGFzc1RvVXNlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICB1dGlscy5hZGRDc3NDbGFzcyhlR3JpZENlbGwsIGNsYXNzVG9Vc2UpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShjbGFzc1RvVXNlKSkge1xyXG4gICAgICAgICAgICBjbGFzc1RvVXNlLmZvckVhY2goZnVuY3Rpb24oY3NzQ2xhc3NJdGVtKSB7XHJcbiAgICAgICAgICAgICAgICB1dGlscy5hZGRDc3NDbGFzcyhlR3JpZENlbGwsIGNzc0NsYXNzSXRlbSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5hZGRDbGFzc2VzVG9DZWxsID0gZnVuY3Rpb24oY29sdW1uLCBub2RlLCBlR3JpZENlbGwpIHtcclxuICAgIHZhciBjbGFzc2VzID0gWydhZy1jZWxsJywgJ2FnLWNlbGwtbm8tZm9jdXMnLCAnY2VsbC1jb2wtJyArIGNvbHVtbi5pbmRleF07XHJcbiAgICBpZiAobm9kZS5ncm91cCkge1xyXG4gICAgICAgIGlmIChub2RlLmZvb3Rlcikge1xyXG4gICAgICAgICAgICBjbGFzc2VzLnB1c2goJ2FnLWZvb3Rlci1jZWxsJyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKCdhZy1ncm91cC1jZWxsJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZUdyaWRDZWxsLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpO1xyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLmFkZENsYXNzZXNGcm9tUnVsZXMgPSBmdW5jdGlvbihjb2xEZWYsIGVHcmlkQ2VsbCwgdmFsdWUsIG5vZGUsIHJvd0luZGV4KSB7XHJcbiAgICB2YXIgY2xhc3NSdWxlcyA9IGNvbERlZi5jZWxsQ2xhc3NSdWxlcztcclxuICAgIGlmICh0eXBlb2YgY2xhc3NSdWxlcyA9PT0gJ29iamVjdCcpIHtcclxuXHJcbiAgICAgICAgdmFyIHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxyXG4gICAgICAgICAgICBkYXRhOiBub2RlLmRhdGEsXHJcbiAgICAgICAgICAgIG5vZGU6IG5vZGUsXHJcbiAgICAgICAgICAgIGNvbERlZjogY29sRGVmLFxyXG4gICAgICAgICAgICByb3dJbmRleDogcm93SW5kZXgsXHJcbiAgICAgICAgICAgIGFwaTogdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0QXBpKCksXHJcbiAgICAgICAgICAgIGNvbnRleHQ6IHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldENvbnRleHQoKVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHZhciBjbGFzc05hbWVzID0gT2JqZWN0LmtleXMoY2xhc3NSdWxlcyk7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjbGFzc05hbWVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBjbGFzc05hbWUgPSBjbGFzc05hbWVzW2ldO1xyXG4gICAgICAgICAgICB2YXIgcnVsZSA9IGNsYXNzUnVsZXNbY2xhc3NOYW1lXTtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdE9mUnVsZTtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBydWxlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0T2ZSdWxlID0gdGhpcy5leHByZXNzaW9uU2VydmljZS5ldmFsdWF0ZShydWxlLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBydWxlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRPZlJ1bGUgPSBydWxlKHBhcmFtcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHJlc3VsdE9mUnVsZSkge1xyXG4gICAgICAgICAgICAgICAgdXRpbHMuYWRkQ3NzQ2xhc3MoZUdyaWRDZWxsLCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdXRpbHMucmVtb3ZlQ3NzQ2xhc3MoZUdyaWRDZWxsLCBjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLmNyZWF0ZUNlbGwgPSBmdW5jdGlvbihpc0ZpcnN0Q29sdW1uLCBjb2x1bW4sIHZhbHVlR2V0dGVyLCBub2RlLCByb3dJbmRleCwgJGNoaWxkU2NvcGUpIHtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIHZhciBlR3JpZENlbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgZUdyaWRDZWxsLnNldEF0dHJpYnV0ZShcImNvbFwiLCBjb2x1bW4uaW5kZXgpO1xyXG5cclxuICAgIGVHcmlkQ2VsbC5zZXRBdHRyaWJ1dGUoXCJ0YWJpbmRleFwiLCBcIi0xXCIpO1xyXG5cclxuICAgIHZhciB2YWx1ZTtcclxuICAgIGlmICh2YWx1ZUdldHRlcikge1xyXG4gICAgICAgIHZhbHVlID0gdmFsdWVHZXR0ZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyB0aGVzZSBhcmUgdGhlIGdyaWQgc3R5bGVzLCBkb24ndCBjaGFuZ2UgYmV0d2VlbiBzb2Z0IHJlZnJlc2hlc1xyXG4gICAgdGhpcy5hZGRDbGFzc2VzVG9DZWxsKGNvbHVtbiwgbm9kZSwgZUdyaWRDZWxsKTtcclxuXHJcbiAgICB0aGlzLnBvcHVsYXRlQW5kU3R5bGVHcmlkQ2VsbCh2YWx1ZUdldHRlciwgdmFsdWUsIGVHcmlkQ2VsbCwgaXNGaXJzdENvbHVtbiwgbm9kZSwgY29sdW1uLCByb3dJbmRleCwgJGNoaWxkU2NvcGUpO1xyXG5cclxuICAgIHRoaXMuYWRkQ2VsbENsaWNrZWRIYW5kbGVyKGVHcmlkQ2VsbCwgbm9kZSwgY29sdW1uLCB2YWx1ZSwgcm93SW5kZXgpO1xyXG4gICAgdGhpcy5hZGRDZWxsRG91YmxlQ2xpY2tlZEhhbmRsZXIoZUdyaWRDZWxsLCBub2RlLCBjb2x1bW4sIHZhbHVlLCByb3dJbmRleCwgJGNoaWxkU2NvcGUsIGlzRmlyc3RDb2x1bW4sIHZhbHVlR2V0dGVyKTtcclxuXHJcbiAgICB0aGlzLmFkZENlbGxOYXZpZ2F0aW9uSGFuZGxlcihlR3JpZENlbGwsIHJvd0luZGV4LCBjb2x1bW4pO1xyXG5cclxuICAgIGVHcmlkQ2VsbC5zdHlsZS53aWR0aCA9IHV0aWxzLmZvcm1hdFdpZHRoKGNvbHVtbi5hY3R1YWxXaWR0aCk7XHJcblxyXG4gICAgLy8gYWRkIHRoZSAnc3RhcnQgZWRpdGluZycgY2FsbCB0byB0aGUgY2hhaW4gb2YgZWRpdG9yc1xyXG4gICAgdGhpcy5yZW5kZXJlZFJvd1N0YXJ0RWRpdGluZ0xpc3RlbmVyc1tyb3dJbmRleF1bY29sdW1uLmluZGV4XSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmICh0aGF0LmlzQ2VsbEVkaXRhYmxlKGNvbHVtbi5jb2xEZWYsIG5vZGUpKSB7XHJcbiAgICAgICAgICAgIHRoYXQuc3RhcnRFZGl0aW5nKGVHcmlkQ2VsbCwgY29sdW1uLCBub2RlLCAkY2hpbGRTY29wZSwgcm93SW5kZXgsIGlzRmlyc3RDb2x1bW4sIHZhbHVlR2V0dGVyKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIGVHcmlkQ2VsbDtcclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5hZGRDZWxsTmF2aWdhdGlvbkhhbmRsZXIgPSBmdW5jdGlvbihlR3JpZENlbGwsIHJvd0luZGV4LCBjb2x1bW4pIHtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIGVHcmlkQ2VsbC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICB2YXIga2V5ID0gZXZlbnQud2hpY2ggfHwgZXZlbnQua2V5Q29kZTtcclxuICAgICAgICBpZiAoa2V5ID09PSBET1dOX0tFWSB8fCBrZXkgPT09IFVQX0tFWSB8fCBrZXkgPT09IExFRlRfS0VZIHx8IGtleSA9PT0gUklHSFRfS0VZKSB7XHJcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgIHRoYXQubmF2aWdhdGVUb05leHRDZWxsKGtleSwgcm93SW5kZXgsIGNvbHVtbik7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUubmF2aWdhdGVUb05leHRDZWxsID0gZnVuY3Rpb24oa2V5LCByb3dJbmRleCwgY29sdW1uKSB7XHJcblxyXG4gICAgdmFyIHJvd1RvRm9jdXM7XHJcbiAgICB2YXIgY29sVG9Gb2N1cztcclxuXHJcbiAgICBzd2l0Y2ggKGtleSkge1xyXG4gICAgICAgIGNhc2UgVVBfS0VZIDpcclxuICAgICAgICAgICAgLy8gaWYgYWxyZWFkeSBvbiB0b3Agcm93LCBkbyBub3RoaW5nXHJcbiAgICAgICAgICAgIGlmIChyb3dJbmRleCA9PT0gdGhpcy5maXJzdFZpcnR1YWxSZW5kZXJlZFJvdykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJvd1RvRm9jdXMgPSByb3dJbmRleCAtIDE7XHJcbiAgICAgICAgICAgIGNvbFRvRm9jdXMgPSBjb2x1bW4uaW5kZXg7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRE9XTl9LRVkgOlxyXG4gICAgICAgICAgICAvLyBpZiBhbHJlYWR5IG9uIGJvdHRvbSwgZG8gbm90aGluZ1xyXG4gICAgICAgICAgICBpZiAocm93SW5kZXggPT09IHRoaXMubGFzdFZpcnR1YWxSZW5kZXJlZFJvdykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJvd1RvRm9jdXMgPSByb3dJbmRleCArIDE7XHJcbiAgICAgICAgICAgIGNvbFRvRm9jdXMgPSBjb2x1bW4uaW5kZXg7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgUklHSFRfS0VZIDpcclxuICAgICAgICAgICAgdmFyIGNvbFRvUmlnaHQgPSB0aGlzLmNvbHVtbk1vZGVsLmdldFZpc2libGVDb2xBZnRlcihjb2x1bW4pO1xyXG4gICAgICAgICAgICAvLyBpZiBhbHJlYWR5IG9uIHJpZ2h0LCBkbyBub3RoaW5nXHJcbiAgICAgICAgICAgIGlmICghY29sVG9SaWdodCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJvd1RvRm9jdXMgPSByb3dJbmRleCA7XHJcbiAgICAgICAgICAgIGNvbFRvRm9jdXMgPSBjb2xUb1JpZ2h0LmluZGV4O1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIExFRlRfS0VZIDpcclxuICAgICAgICAgICAgdmFyIGNvbFRvTGVmdCA9IHRoaXMuY29sdW1uTW9kZWwuZ2V0VmlzaWJsZUNvbEJlZm9yZShjb2x1bW4pO1xyXG4gICAgICAgICAgICAvLyBpZiBhbHJlYWR5IG9uIHJpZ2h0LCBkbyBub3RoaW5nXHJcbiAgICAgICAgICAgIGlmICghY29sVG9MZWZ0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcm93VG9Gb2N1cyA9IHJvd0luZGV4IDtcclxuICAgICAgICAgICAgY29sVG9Gb2N1cyA9IGNvbFRvTGVmdC5pbmRleDtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHJlbmRlcmVkUm93ID0gdGhpcy5yZW5kZXJlZFJvd3Nbcm93VG9Gb2N1c107XHJcbiAgICB2YXIgZUNlbGwgPSByZW5kZXJlZFJvdy5lQ2VsbHNbY29sVG9Gb2N1c107XHJcblxyXG4gICAgLy8gdGhpcyBzY3JvbGxzIHRoZSByb3cgaW50byB2aWV3XHJcbiAgICB0aGlzLmFuZ3VsYXJHcmlkLmVuc3VyZUluZGV4VmlzaWJsZShyZW5kZXJlZFJvdy5yb3dJbmRleCk7XHJcblxyXG4gICAgLy8gdGhpcyBjaGFuZ2VzIHRoZSBjc3Mgb24gdGhlIGNlbGxcclxuICAgIHRoaXMuZm9jdXNDZWxsKHJvd1RvRm9jdXMsIGNvbFRvRm9jdXMpO1xyXG4gICAgLy8gdGhpcyBwdXRzIHRoZSBicm93c2VyIGZvY3VzIG9uIHRoZSBjZWxsIChzbyBpdCBnZXRzIGtleSBwcmVzc2VzKVxyXG4gICAgZUNlbGwuZm9jdXMoKTtcclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5mb2N1c0NlbGwgPSBmdW5jdGlvbihyb3dJbmRleCwgY29sSW5kZXgpIHtcclxuICAgIC8vIHJlbW92ZSBhbnkgcHJldmlvdXMgZm9jdXNcclxuICAgIHV0aWxzLnF1ZXJ5U2VsZWN0b3JBbGxfcmVwbGFjZUNzc0NsYXNzKHRoaXMuZVBhcmVudE9mUm93cywgJy5hZy1jZWxsLWZvY3VzJywgJ2FnLWNlbGwtZm9jdXMnLCAnYWctY2VsbC1uby1mb2N1cycpO1xyXG5cclxuICAgIHZhciBzZWxlY3RvckZvckNlbGwgPSAnW3Jvdz1cIicgKyByb3dJbmRleCArICdcIl0gW2NvbD1cIicgKyBjb2xJbmRleCArICdcIl0nO1xyXG4gICAgdXRpbHMucXVlcnlTZWxlY3RvckFsbF9yZXBsYWNlQ3NzQ2xhc3ModGhpcy5lUGFyZW50T2ZSb3dzLCBzZWxlY3RvckZvckNlbGwsICdhZy1jZWxsLW5vLWZvY3VzJywgJ2FnLWNlbGwtZm9jdXMnKTtcclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5wb3B1bGF0ZUFuZFN0eWxlR3JpZENlbGwgPSBmdW5jdGlvbih2YWx1ZUdldHRlciwgdmFsdWUsIGVHcmlkQ2VsbCwgaXNGaXJzdENvbHVtbiwgbm9kZSwgY29sdW1uLCByb3dJbmRleCwgJGNoaWxkU2NvcGUpIHtcclxuICAgIHZhciBjb2xEZWYgPSBjb2x1bW4uY29sRGVmO1xyXG5cclxuICAgIC8vIHBvcHVsYXRlXHJcbiAgICB0aGlzLnBvcHVsYXRlR3JpZENlbGwoZUdyaWRDZWxsLCBpc0ZpcnN0Q29sdW1uLCBub2RlLCBjb2x1bW4sIHJvd0luZGV4LCB2YWx1ZSwgdmFsdWVHZXR0ZXIsICRjaGlsZFNjb3BlKTtcclxuICAgIC8vIHN0eWxlXHJcbiAgICB0aGlzLmFkZFN0eWxlc0Zyb21Db2xsRGVmKGNvbHVtbiwgdmFsdWUsIG5vZGUsICRjaGlsZFNjb3BlLCBlR3JpZENlbGwpO1xyXG4gICAgdGhpcy5hZGRDbGFzc2VzRnJvbUNvbGxEZWYoY29sRGVmLCB2YWx1ZSwgbm9kZSwgJGNoaWxkU2NvcGUsIGVHcmlkQ2VsbCk7XHJcbiAgICB0aGlzLmFkZENsYXNzZXNGcm9tUnVsZXMoY29sRGVmLCBlR3JpZENlbGwsIHZhbHVlLCBub2RlLCByb3dJbmRleCk7XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUucG9wdWxhdGVHcmlkQ2VsbCA9IGZ1bmN0aW9uKGVHcmlkQ2VsbCwgaXNGaXJzdENvbHVtbiwgbm9kZSwgY29sdW1uLCByb3dJbmRleCwgdmFsdWUsIHZhbHVlR2V0dGVyLCAkY2hpbGRTY29wZSkge1xyXG4gICAgdmFyIGVDZWxsV3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgIGVHcmlkQ2VsbC5hcHBlbmRDaGlsZChlQ2VsbFdyYXBwZXIpO1xyXG5cclxuICAgIHZhciBjb2xEZWYgPSBjb2x1bW4uY29sRGVmO1xyXG4gICAgaWYgKGNvbERlZi5jaGVja2JveFNlbGVjdGlvbikge1xyXG4gICAgICAgIHZhciBlQ2hlY2tib3ggPSB0aGlzLnNlbGVjdGlvblJlbmRlcmVyRmFjdG9yeS5jcmVhdGVTZWxlY3Rpb25DaGVja2JveChub2RlLCByb3dJbmRleCk7XHJcbiAgICAgICAgZUNlbGxXcmFwcGVyLmFwcGVuZENoaWxkKGVDaGVja2JveCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGVTcGFuV2l0aFZhbHVlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XHJcbiAgICBlQ2VsbFdyYXBwZXIuYXBwZW5kQ2hpbGQoZVNwYW5XaXRoVmFsdWUpO1xyXG5cclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIHZhciByZWZyZXNoQ2VsbEZ1bmN0aW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhhdC5zb2Z0UmVmcmVzaENlbGwoZUdyaWRDZWxsLCBpc0ZpcnN0Q29sdW1uLCBub2RlLCBjb2x1bW4sICRjaGlsZFNjb3BlLCByb3dJbmRleCk7XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMucHV0RGF0YUludG9DZWxsKGNvbHVtbiwgdmFsdWUsIHZhbHVlR2V0dGVyLCBub2RlLCAkY2hpbGRTY29wZSwgZVNwYW5XaXRoVmFsdWUsIHJvd0luZGV4LCByZWZyZXNoQ2VsbEZ1bmN0aW9uKTtcclxufTtcclxuXHJcblJvd1JlbmRlcmVyLnByb3RvdHlwZS5hZGRDZWxsRG91YmxlQ2xpY2tlZEhhbmRsZXIgPSBmdW5jdGlvbihlR3JpZENlbGwsIG5vZGUsIGNvbHVtbiwgdmFsdWUsIHJvd0luZGV4LCAkY2hpbGRTY29wZSwgaXNGaXJzdENvbHVtbiwgdmFsdWVHZXR0ZXIpIHtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIHZhciBjb2xEZWYgPSBjb2x1bW4uY29sRGVmO1xyXG4gICAgZUdyaWRDZWxsLmFkZEV2ZW50TGlzdGVuZXIoXCJkYmxjbGlja1wiLCBmdW5jdGlvbihldmVudCkge1xyXG4gICAgICAgIGlmICh0aGF0LmdyaWRPcHRpb25zV3JhcHBlci5nZXRDZWxsRG91YmxlQ2xpY2tlZCgpKSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJhbXNGb3JHcmlkID0ge1xyXG4gICAgICAgICAgICAgICAgbm9kZTogbm9kZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IG5vZGUuZGF0YSxcclxuICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcclxuICAgICAgICAgICAgICAgIHJvd0luZGV4OiByb3dJbmRleCxcclxuICAgICAgICAgICAgICAgIGNvbERlZjogY29sRGVmLFxyXG4gICAgICAgICAgICAgICAgZXZlbnQ6IGV2ZW50LFxyXG4gICAgICAgICAgICAgICAgZXZlbnRTb3VyY2U6IHRoaXMsXHJcbiAgICAgICAgICAgICAgICBhcGk6IHRoYXQuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldEFwaSgpXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHRoYXQuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldENlbGxEb3VibGVDbGlja2VkKCkocGFyYW1zRm9yR3JpZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChjb2xEZWYuY2VsbERvdWJsZUNsaWNrZWQpIHtcclxuICAgICAgICAgICAgdmFyIHBhcmFtc0ZvckNvbERlZiA9IHtcclxuICAgICAgICAgICAgICAgIG5vZGU6IG5vZGUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiBub2RlLmRhdGEsXHJcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUsXHJcbiAgICAgICAgICAgICAgICByb3dJbmRleDogcm93SW5kZXgsXHJcbiAgICAgICAgICAgICAgICBjb2xEZWY6IGNvbERlZixcclxuICAgICAgICAgICAgICAgIGV2ZW50OiBldmVudCxcclxuICAgICAgICAgICAgICAgIGV2ZW50U291cmNlOiB0aGlzLFxyXG4gICAgICAgICAgICAgICAgYXBpOiB0aGF0LmdyaWRPcHRpb25zV3JhcHBlci5nZXRBcGkoKVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBjb2xEZWYuY2VsbERvdWJsZUNsaWNrZWQocGFyYW1zRm9yQ29sRGVmKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoYXQuaXNDZWxsRWRpdGFibGUoY29sRGVmLCBub2RlKSkge1xyXG4gICAgICAgICAgICB0aGF0LnN0YXJ0RWRpdGluZyhlR3JpZENlbGwsIGNvbHVtbiwgbm9kZSwgJGNoaWxkU2NvcGUsIHJvd0luZGV4LCBpc0ZpcnN0Q29sdW1uLCB2YWx1ZUdldHRlcik7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUuYWRkQ2VsbENsaWNrZWRIYW5kbGVyID0gZnVuY3Rpb24oZUdyaWRDZWxsLCBub2RlLCBjb2x1bW4sIHZhbHVlLCByb3dJbmRleCkge1xyXG4gICAgdmFyIGNvbERlZiA9IGNvbHVtbi5jb2xEZWY7XHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICBlR3JpZENlbGwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICAgICAgLy90aGF0LmZvY3VzQ2VsbChyb3dJbmRleCwgY29sdW1uLmluZGV4KTtcclxuICAgICAgICBpZiAodGhhdC5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0Q2VsbENsaWNrZWQoKSkge1xyXG4gICAgICAgICAgICB2YXIgcGFyYW1zRm9yR3JpZCA9IHtcclxuICAgICAgICAgICAgICAgIG5vZGU6IG5vZGUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiBub2RlLmRhdGEsXHJcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUsXHJcbiAgICAgICAgICAgICAgICByb3dJbmRleDogcm93SW5kZXgsXHJcbiAgICAgICAgICAgICAgICBjb2xEZWY6IGNvbERlZixcclxuICAgICAgICAgICAgICAgIGV2ZW50OiBldmVudCxcclxuICAgICAgICAgICAgICAgIGV2ZW50U291cmNlOiB0aGlzLFxyXG4gICAgICAgICAgICAgICAgYXBpOiB0aGF0LmdyaWRPcHRpb25zV3JhcHBlci5nZXRBcGkoKVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0aGF0LmdyaWRPcHRpb25zV3JhcHBlci5nZXRDZWxsQ2xpY2tlZCgpKHBhcmFtc0ZvckdyaWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoY29sRGVmLmNlbGxDbGlja2VkKSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJhbXNGb3JDb2xEZWYgPSB7XHJcbiAgICAgICAgICAgICAgICBub2RlOiBub2RlLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogbm9kZS5kYXRhLFxyXG4gICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxyXG4gICAgICAgICAgICAgICAgcm93SW5kZXg6IHJvd0luZGV4LFxyXG4gICAgICAgICAgICAgICAgY29sRGVmOiBjb2xEZWYsXHJcbiAgICAgICAgICAgICAgICBldmVudDogZXZlbnQsXHJcbiAgICAgICAgICAgICAgICBldmVudFNvdXJjZTogdGhpcyxcclxuICAgICAgICAgICAgICAgIGFwaTogdGhhdC5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0QXBpKClcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgY29sRGVmLmNlbGxDbGlja2VkKHBhcmFtc0ZvckNvbERlZik7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn07XHJcblxyXG5Sb3dSZW5kZXJlci5wcm90b3R5cGUuaXNDZWxsRWRpdGFibGUgPSBmdW5jdGlvbihjb2xEZWYsIG5vZGUpIHtcclxuICAgIGlmICh0aGlzLmVkaXRpbmdDZWxsKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIG5ldmVyIGFsbG93IGVkaXRpbmcgb2YgZ3JvdXBzXHJcbiAgICBpZiAobm9kZS5ncm91cCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBpZiBib29sZWFuIHNldCwgdGhlbiBqdXN0IHVzZSBpdFxyXG4gICAgaWYgKHR5cGVvZiBjb2xEZWYuZWRpdGFibGUgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgIHJldHVybiBjb2xEZWYuZWRpdGFibGU7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gaWYgZnVuY3Rpb24sIHRoZW4gY2FsbCB0aGUgZnVuY3Rpb24gdG8gZmluZCBvdXRcclxuICAgIGlmICh0eXBlb2YgY29sRGVmLmVkaXRhYmxlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgLy8gc2hvdWxkIGNoYW5nZSB0aGlzLCBzbyBpdCBnZXRzIHBhc3NlZCBwYXJhbXMgd2l0aCBuaWNlIHVzZWZ1bCB2YWx1ZXNcclxuICAgICAgICByZXR1cm4gY29sRGVmLmVkaXRhYmxlKG5vZGUuZGF0YSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLnN0b3BFZGl0aW5nID0gZnVuY3Rpb24oZUdyaWRDZWxsLCBjb2x1bW4sIG5vZGUsICRjaGlsZFNjb3BlLCBlSW5wdXQsIGJsdXJMaXN0ZW5lciwgcm93SW5kZXgsIGlzRmlyc3RDb2x1bW4sIHZhbHVlR2V0dGVyKSB7XHJcbiAgICB0aGlzLmVkaXRpbmdDZWxsID0gZmFsc2U7XHJcbiAgICB2YXIgbmV3VmFsdWUgPSBlSW5wdXQudmFsdWU7XHJcbiAgICB2YXIgY29sRGVmID0gY29sdW1uLmNvbERlZjtcclxuXHJcbiAgICAvL0lmIHdlIGRvbid0IHJlbW92ZSB0aGUgYmx1ciBsaXN0ZW5lciBmaXJzdCwgd2UgZ2V0OlxyXG4gICAgLy9VbmNhdWdodCBOb3RGb3VuZEVycm9yOiBGYWlsZWQgdG8gZXhlY3V0ZSAncmVtb3ZlQ2hpbGQnIG9uICdOb2RlJzogVGhlIG5vZGUgdG8gYmUgcmVtb3ZlZCBpcyBubyBsb25nZXIgYSBjaGlsZCBvZiB0aGlzIG5vZGUuIFBlcmhhcHMgaXQgd2FzIG1vdmVkIGluIGEgJ2JsdXInIGV2ZW50IGhhbmRsZXI/XHJcbiAgICBlSW5wdXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignYmx1cicsIGJsdXJMaXN0ZW5lcik7XHJcblxyXG4gICAgdXRpbHMucmVtb3ZlQWxsQ2hpbGRyZW4oZUdyaWRDZWxsKTtcclxuXHJcbiAgICB2YXIgcGFyYW1zRm9yQ2FsbGJhY2tzID0ge1xyXG4gICAgICAgIG5vZGU6IG5vZGUsXHJcbiAgICAgICAgZGF0YTogbm9kZS5kYXRhLFxyXG4gICAgICAgIG9sZFZhbHVlOiBub2RlLmRhdGFbY29sRGVmLmZpZWxkXSxcclxuICAgICAgICBuZXdWYWx1ZTogbmV3VmFsdWUsXHJcbiAgICAgICAgcm93SW5kZXg6IHJvd0luZGV4LFxyXG4gICAgICAgIGNvbERlZjogY29sRGVmLFxyXG4gICAgICAgIGFwaTogdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0QXBpKCksXHJcbiAgICAgICAgY29udGV4dDogdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuZ2V0Q29udGV4dCgpXHJcbiAgICB9O1xyXG5cclxuICAgIGlmIChjb2xEZWYubmV3VmFsdWVIYW5kbGVyKSB7XHJcbiAgICAgICAgY29sRGVmLm5ld1ZhbHVlSGFuZGxlcihwYXJhbXNGb3JDYWxsYmFja3MpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBub2RlLmRhdGFbY29sRGVmLmZpZWxkXSA9IG5ld1ZhbHVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGF0IHRoaXMgcG9pbnQsIHRoZSB2YWx1ZSBoYXMgYmVlbiB1cGRhdGVkXHJcbiAgICB2YXIgbmV3VmFsdWU7XHJcbiAgICBpZiAodmFsdWVHZXR0ZXIpIHtcclxuICAgICAgICBuZXdWYWx1ZSA9IHZhbHVlR2V0dGVyKCk7XHJcbiAgICB9XHJcbiAgICBwYXJhbXNGb3JDYWxsYmFja3MubmV3VmFsdWUgPSBuZXdWYWx1ZTtcclxuICAgIGlmICh0eXBlb2YgY29sRGVmLmNlbGxWYWx1ZUNoYW5nZWQgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICBjb2xEZWYuY2VsbFZhbHVlQ2hhbmdlZChwYXJhbXNGb3JDYWxsYmFja3MpO1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRDZWxsVmFsdWVDaGFuZ2VkKCkgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRDZWxsVmFsdWVDaGFuZ2VkKCkocGFyYW1zRm9yQ2FsbGJhY2tzKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnBvcHVsYXRlQW5kU3R5bGVHcmlkQ2VsbCh2YWx1ZUdldHRlciwgbmV3VmFsdWUsIGVHcmlkQ2VsbCwgaXNGaXJzdENvbHVtbiwgbm9kZSwgY29sdW1uLCByb3dJbmRleCwgJGNoaWxkU2NvcGUpO1xyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLnN0YXJ0RWRpdGluZyA9IGZ1bmN0aW9uKGVHcmlkQ2VsbCwgY29sdW1uLCBub2RlLCAkY2hpbGRTY29wZSwgcm93SW5kZXgsIGlzRmlyc3RDb2x1bW4sIHZhbHVlR2V0dGVyKSB7XHJcbiAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICB0aGlzLmVkaXRpbmdDZWxsID0gdHJ1ZTtcclxuICAgIHV0aWxzLnJlbW92ZUFsbENoaWxkcmVuKGVHcmlkQ2VsbCk7XHJcbiAgICB2YXIgZUlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICAgIGVJbnB1dC50eXBlID0gJ3RleHQnO1xyXG4gICAgdXRpbHMuYWRkQ3NzQ2xhc3MoZUlucHV0LCAnYWctY2VsbC1lZGl0LWlucHV0Jyk7XHJcblxyXG4gICAgaWYgKHZhbHVlR2V0dGVyKSB7XHJcbiAgICAgICAgdmFyIHZhbHVlID0gdmFsdWVHZXR0ZXIoKTtcclxuICAgICAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBlSW5wdXQudmFsdWUgPSB2YWx1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZUlucHV0LnN0eWxlLndpZHRoID0gKGNvbHVtbi5hY3R1YWxXaWR0aCAtIDE0KSArICdweCc7XHJcbiAgICBlR3JpZENlbGwuYXBwZW5kQ2hpbGQoZUlucHV0KTtcclxuICAgIGVJbnB1dC5mb2N1cygpO1xyXG4gICAgZUlucHV0LnNlbGVjdCgpO1xyXG5cclxuICAgIHZhciBibHVyTGlzdGVuZXIgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGF0LnN0b3BFZGl0aW5nKGVHcmlkQ2VsbCwgY29sdW1uLCBub2RlLCAkY2hpbGRTY29wZSwgZUlucHV0LCBibHVyTGlzdGVuZXIsIHJvd0luZGV4LCBpc0ZpcnN0Q29sdW1uLCB2YWx1ZUdldHRlcik7XHJcbiAgICB9O1xyXG5cclxuICAgIC8vc3RvcCBlbnRlcmluZyBpZiB3ZSBsb29zZSBmb2N1c1xyXG4gICAgZUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIGJsdXJMaXN0ZW5lcik7XHJcblxyXG4gICAgLy9zdG9wIGVkaXRpbmcgaWYgZW50ZXIgcHJlc3NlZFxyXG4gICAgZUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXByZXNzJywgZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICB2YXIga2V5ID0gZXZlbnQud2hpY2ggfHwgZXZlbnQua2V5Q29kZTtcclxuICAgICAgICAvLyAxMyBpcyBlbnRlclxyXG4gICAgICAgIGlmIChrZXkgPT0gRU5URVJfS0VZKSB7XHJcbiAgICAgICAgICAgIHRoYXQuc3RvcEVkaXRpbmcoZUdyaWRDZWxsLCBjb2x1bW4sIG5vZGUsICRjaGlsZFNjb3BlLCBlSW5wdXQsIGJsdXJMaXN0ZW5lciwgcm93SW5kZXgsIGlzRmlyc3RDb2x1bW4sIHZhbHVlR2V0dGVyKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyB0YWIga2V5IGRvZXNuJ3QgZ2VuZXJhdGUga2V5cHJlc3MsIHNvIG5lZWQga2V5ZG93biB0byBsaXN0ZW4gZm9yIHRoYXRcclxuICAgIGVJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICB2YXIga2V5ID0gZXZlbnQud2hpY2ggfHwgZXZlbnQua2V5Q29kZTtcclxuICAgICAgICBpZiAoa2V5ID09IFRBQl9LRVkpIHtcclxuICAgICAgICAgICAgdGhhdC5zdG9wRWRpdGluZyhlR3JpZENlbGwsIGNvbHVtbiwgbm9kZSwgJGNoaWxkU2NvcGUsIGVJbnB1dCwgYmx1ckxpc3RlbmVyLCByb3dJbmRleCwgaXNGaXJzdENvbHVtbiwgdmFsdWVHZXR0ZXIpO1xyXG4gICAgICAgICAgICB0aGF0LnN0YXJ0RWRpdGluZ05leHRDZWxsKHJvd0luZGV4LCBjb2x1bW4sIGV2ZW50LnNoaWZ0S2V5KTtcclxuICAgICAgICAgICAgLy8gd2UgZG9uJ3Qgd2FudCB0aGUgZGVmYXVsdCB0YWIgYWN0aW9uLCBzbyByZXR1cm4gZmFsc2UsIHRoaXMgc3RvcHMgdGhlIGV2ZW50IGZyb20gYnViYmxpbmdcclxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59O1xyXG5cclxuUm93UmVuZGVyZXIucHJvdG90eXBlLnN0YXJ0RWRpdGluZ05leHRDZWxsID0gZnVuY3Rpb24ocm93SW5kZXgsIGNvbHVtbiwgc2hpZnRLZXkpIHtcclxuXHJcbiAgICB2YXIgZmlyc3RSb3dUb0NoZWNrID0gdGhpcy5maXJzdFZpcnR1YWxSZW5kZXJlZFJvdztcclxuICAgIHZhciBsYXN0Um93VG9DaGVjayA9IHRoaXMubGFzdFZpcnR1YWxSZW5kZXJlZFJvdztcclxuICAgIHZhciBjdXJyZW50Um93SW5kZXggPSByb3dJbmRleDtcclxuXHJcbiAgICB2YXIgdmlzaWJsZUNvbHVtbnMgPSB0aGlzLmNvbHVtbk1vZGVsLmdldFZpc2libGVDb2x1bW5zKCk7XHJcbiAgICB2YXIgY3VycmVudENvbCA9IGNvbHVtbjtcclxuXHJcbiAgICB3aGlsZSAodHJ1ZSkge1xyXG5cclxuICAgICAgICB2YXIgaW5kZXhPZkN1cnJlbnRDb2wgPSB2aXNpYmxlQ29sdW1ucy5pbmRleE9mKGN1cnJlbnRDb2wpO1xyXG5cclxuICAgICAgICAvLyBtb3ZlIGJhY2t3YXJkXHJcbiAgICAgICAgaWYgKHNoaWZ0S2V5KSB7XHJcbiAgICAgICAgICAgIC8vIG1vdmUgYWxvbmcgdG8gdGhlIHByZXZpb3VzIGNlbGxcclxuICAgICAgICAgICAgY3VycmVudENvbCA9IHZpc2libGVDb2x1bW5zW2luZGV4T2ZDdXJyZW50Q29sIC0gMV07XHJcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIGVuZCBvZiB0aGUgcm93LCBhbmQgaWYgc28sIGdvIGJhY2sgYSByb3dcclxuICAgICAgICAgICAgaWYgKCFjdXJyZW50Q29sKSB7XHJcbiAgICAgICAgICAgICAgICBjdXJyZW50Q29sID0gdmlzaWJsZUNvbHVtbnNbdmlzaWJsZUNvbHVtbnMubGVuZ3RoIC0gMV07XHJcbiAgICAgICAgICAgICAgICBjdXJyZW50Um93SW5kZXgtLTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gaWYgZ290IHRvIGVuZCBvZiByZW5kZXJlZCByb3dzLCB0aGVuIHF1aXQgbG9va2luZ1xyXG4gICAgICAgICAgICBpZiAoY3VycmVudFJvd0luZGV4IDwgZmlyc3RSb3dUb0NoZWNrKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gbW92ZSBmb3J3YXJkXHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gbW92ZSBhbG9uZyB0byB0aGUgbmV4dCBjZWxsXHJcbiAgICAgICAgICAgIGN1cnJlbnRDb2wgPSB2aXNpYmxlQ29sdW1uc1tpbmRleE9mQ3VycmVudENvbCArIDFdO1xyXG4gICAgICAgICAgICAvLyBjaGVjayBpZiBlbmQgb2YgdGhlIHJvdywgYW5kIGlmIHNvLCBnbyBmb3J3YXJkIGEgcm93XHJcbiAgICAgICAgICAgIGlmICghY3VycmVudENvbCkge1xyXG4gICAgICAgICAgICAgICAgY3VycmVudENvbCA9IHZpc2libGVDb2x1bW5zWzBdO1xyXG4gICAgICAgICAgICAgICAgY3VycmVudFJvd0luZGV4Kys7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGlmIGdvdCB0byBlbmQgb2YgcmVuZGVyZWQgcm93cywgdGhlbiBxdWl0IGxvb2tpbmdcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnRSb3dJbmRleCA+IGxhc3RSb3dUb0NoZWNrKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBuZXh0RnVuYyA9IHRoaXMucmVuZGVyZWRSb3dTdGFydEVkaXRpbmdMaXN0ZW5lcnNbY3VycmVudFJvd0luZGV4XVtjdXJyZW50Q29sLmNvbEtleV07XHJcbiAgICAgICAgaWYgKG5leHRGdW5jKSB7XHJcbiAgICAgICAgICAgIC8vIHNlZSBpZiB0aGUgbmV4dCBjZWxsIGlzIGVkaXRhYmxlLCBhbmQgaWYgc28sIHdlIGhhdmUgY29tZSB0b1xyXG4gICAgICAgICAgICAvLyB0aGUgZW5kIG9mIG91ciBzZWFyY2gsIHNvIHN0b3AgbG9va2luZyBmb3IgdGhlIG5leHQgY2VsbFxyXG4gICAgICAgICAgICB2YXIgbmV4dENlbGxBY2NlcHRlZEVkaXQgPSBuZXh0RnVuYygpO1xyXG4gICAgICAgICAgICBpZiAobmV4dENlbGxBY2NlcHRlZEVkaXQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFJvd1JlbmRlcmVyO1xyXG4iLCJ2YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XHJcblxyXG4vLyB0aGVzZSBjb25zdGFudHMgYXJlIHVzZWQgZm9yIGRldGVybWluaW5nIGlmIGdyb3VwcyBzaG91bGRcclxuLy8gYmUgc2VsZWN0ZWQgb3IgZGVzZWxlY3RlZCB3aGVuIHNlbGVjdGluZyBncm91cHMsIGFuZCB0aGUgZ3JvdXBcclxuLy8gdGhlbiBzZWxlY3RzIHRoZSBjaGlsZHJlbi5cclxudmFyIFNFTEVDVEVEID0gMDtcclxudmFyIFVOU0VMRUNURUQgPSAxO1xyXG52YXIgTUlYRUQgPSAyO1xyXG52YXIgRE9fTk9UX0NBUkUgPSAzO1xyXG5cclxuZnVuY3Rpb24gU2VsZWN0aW9uQ29udHJvbGxlcigpIHt9XHJcblxyXG5TZWxlY3Rpb25Db250cm9sbGVyLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oYW5ndWxhckdyaWQsIGVSb3dzUGFyZW50LCBncmlkT3B0aW9uc1dyYXBwZXIsICRzY29wZSwgcm93UmVuZGVyZXIpIHtcclxuICAgIHRoaXMuZVJvd3NQYXJlbnQgPSBlUm93c1BhcmVudDtcclxuICAgIHRoaXMuYW5ndWxhckdyaWQgPSBhbmd1bGFyR3JpZDtcclxuICAgIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyID0gZ3JpZE9wdGlvbnNXcmFwcGVyO1xyXG4gICAgdGhpcy4kc2NvcGUgPSAkc2NvcGU7XHJcbiAgICB0aGlzLnJvd1JlbmRlcmVyID0gcm93UmVuZGVyZXI7XHJcblxyXG4gICAgdGhpcy5zZWxlY3RlZE5vZGVzQnlJZCA9IHt9O1xyXG4gICAgdGhpcy5zZWxlY3RlZFJvd3MgPSBbXTtcclxuXHJcbiAgICBncmlkT3B0aW9uc1dyYXBwZXIuc2V0U2VsZWN0ZWRSb3dzKHRoaXMuc2VsZWN0ZWRSb3dzKTtcclxuICAgIGdyaWRPcHRpb25zV3JhcHBlci5zZXRTZWxlY3RlZE5vZGVzQnlJZCh0aGlzLnNlbGVjdGVkTm9kZXNCeUlkKTtcclxufTtcclxuXHJcblNlbGVjdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLmdldFNlbGVjdGVkTm9kZXMgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzZWxlY3RlZE5vZGVzID0gW107XHJcbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuc2VsZWN0ZWROb2Rlc0J5SWQpO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFyIGlkID0ga2V5c1tpXTtcclxuICAgICAgICB2YXIgc2VsZWN0ZWROb2RlID0gdGhpcy5zZWxlY3RlZE5vZGVzQnlJZFtpZF07XHJcbiAgICAgICAgc2VsZWN0ZWROb2Rlcy5wdXNoKHNlbGVjdGVkTm9kZSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gc2VsZWN0ZWROb2RlcztcclxufTtcclxuXHJcbi8vIHJldHVybnMgYSBsaXN0IG9mIGFsbCBub2RlcyBhdCAnYmVzdCBjb3N0JyAtIGEgZmVhdHVyZSB0byBiZSB1c2VkXHJcbi8vIHdpdGggZ3JvdXBzIC8gdHJlZXMuIGlmIGEgZ3JvdXAgaGFzIGFsbCBpdCdzIGNoaWxkcmVuIHNlbGVjdGVkLFxyXG4vLyB0aGVuIHRoZSBncm91cCBhcHBlYXJzIGluIHRoZSByZXN1bHQsIGJ1dCBub3QgdGhlIGNoaWxkcmVuLlxyXG4vLyBEZXNpZ25lZCBmb3IgdXNlIHdpdGggJ2NoaWxkcmVuJyBhcyB0aGUgZ3JvdXAgc2VsZWN0aW9uIHR5cGUsXHJcbi8vIHdoZXJlIGdyb3VwcyBkb24ndCBhY3R1YWxseSBhcHBlYXIgaW4gdGhlIHNlbGVjdGlvbiBub3JtYWxseS5cclxuU2VsZWN0aW9uQ29udHJvbGxlci5wcm90b3R5cGUuZ2V0QmVzdENvc3ROb2RlU2VsZWN0aW9uID0gZnVuY3Rpb24oKSB7XHJcblxyXG4gICAgaWYgKHR5cGVvZiB0aGlzLnJvd01vZGVsLmdldFRvcExldmVsTm9kZXMgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICB0aHJvdyAnc2VsZWN0QWxsIG5vdCBhdmFpbGFibGUgd2hlbiByb3dzIGFyZSBvbiB0aGUgc2VydmVyJztcclxuICAgIH1cclxuXHJcbiAgICB2YXIgdG9wTGV2ZWxOb2RlcyA9IHRoaXMucm93TW9kZWwuZ2V0VG9wTGV2ZWxOb2RlcygpO1xyXG5cclxuICAgIHZhciByZXN1bHQgPSBbXTtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuXHJcbiAgICAvLyByZWN1cnNpdmUgZnVuY3Rpb24sIHRvIGZpbmQgdGhlIHNlbGVjdGVkIG5vZGVzXHJcbiAgICBmdW5jdGlvbiB0cmF2ZXJzZShub2Rlcykge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbm9kZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBub2RlID0gbm9kZXNbaV07XHJcbiAgICAgICAgICAgIGlmICh0aGF0LmlzTm9kZVNlbGVjdGVkKG5vZGUpKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChub2RlKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIGlmIG5vdCBzZWxlY3RlZCwgdGhlbiBpZiBpdCdzIGEgZ3JvdXAsIGFuZCB0aGUgZ3JvdXBcclxuICAgICAgICAgICAgICAgIC8vIGhhcyBjaGlsZHJlbiwgY29udGludWUgdG8gc2VhcmNoIGZvciBzZWxlY3Rpb25zXHJcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5ncm91cCAmJiBub2RlLmNoaWxkcmVuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHJhdmVyc2Uobm9kZS5jaGlsZHJlbik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdHJhdmVyc2UodG9wTGV2ZWxOb2Rlcyk7XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufTtcclxuXHJcblNlbGVjdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLnNldFJvd01vZGVsID0gZnVuY3Rpb24ocm93TW9kZWwpIHtcclxuICAgIHRoaXMucm93TW9kZWwgPSByb3dNb2RlbDtcclxufTtcclxuXHJcbi8vIHB1YmxpYyAtIHRoaXMgY2xlYXJzIHRoZSBzZWxlY3Rpb24sIGJ1dCBkb2Vzbid0IGNsZWFyIGRvd24gdGhlIGNzcyAtIHdoZW4gaXQgaXMgY2FsbGVkLCB0aGVcclxuLy8gY2FsbGVyIHRoZW4gZ2V0cyB0aGUgZ3JpZCB0byByZWZyZXNoLlxyXG5TZWxlY3Rpb25Db250cm9sbGVyLnByb3RvdHlwZS5kZXNlbGVjdEFsbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5zZWxlY3RlZFJvd3MubGVuZ3RoID0gMDtcclxuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModGhpcy5zZWxlY3RlZE5vZGVzQnlJZCk7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBkZWxldGUgdGhpcy5zZWxlY3RlZE5vZGVzQnlJZFtrZXlzW2ldXTtcclxuICAgIH1cclxuICAgIHRoaXMuc3luY1NlbGVjdGVkUm93c0FuZENhbGxMaXN0ZW5lcigpO1xyXG59O1xyXG5cclxuLy8gcHVibGljIC0gdGhpcyBzZWxlY3RzIGV2ZXJ5dGhpbmcsIGJ1dCBkb2Vzbid0IGNsZWFyIGRvd24gdGhlIGNzcyAtIHdoZW4gaXQgaXMgY2FsbGVkLCB0aGVcclxuLy8gY2FsbGVyIHRoZW4gZ2V0cyB0aGUgZ3JpZCB0byByZWZyZXNoLlxyXG5TZWxlY3Rpb25Db250cm9sbGVyLnByb3RvdHlwZS5zZWxlY3RBbGwgPSBmdW5jdGlvbigpIHtcclxuXHJcbiAgICBpZiAodHlwZW9mIHRoaXMucm93TW9kZWwuZ2V0VG9wTGV2ZWxOb2RlcyAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIHRocm93ICdzZWxlY3RBbGwgbm90IGF2YWlsYWJsZSB3aGVuIHJvd3MgYXJlIG9uIHRoZSBzZXJ2ZXInO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBzZWxlY3RlZE5vZGVzQnlJZCA9IHRoaXMuc2VsZWN0ZWROb2Rlc0J5SWQ7XHJcbiAgICAvLyBpZiB0aGUgc2VsZWN0aW9uIGlzIFwiZG9uJ3QgaW5jbHVkZSBncm91cHNcIiwgdGhlbiB3ZSBkb24ndCBpbmNsdWRlIHRoZW0hXHJcbiAgICB2YXIgaW5jbHVkZUdyb3VwcyA9ICF0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0dyb3VwU2VsZWN0c0NoaWxkcmVuKCk7XHJcblxyXG4gICAgZnVuY3Rpb24gcmVjdXJzaXZlbHlTZWxlY3Qobm9kZXMpIHtcclxuICAgICAgICBpZiAobm9kZXMpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGk8bm9kZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIHZhciBub2RlID0gbm9kZXNbaV07XHJcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5ncm91cCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlY3Vyc2l2ZWx5U2VsZWN0KG5vZGUuY2hpbGRyZW4pO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlR3JvdXBzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkTm9kZXNCeUlkW25vZGUuaWRdID0gbm9kZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkTm9kZXNCeUlkW25vZGUuaWRdID0gbm9kZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB2YXIgdG9wTGV2ZWxOb2RlcyA9IHRoaXMucm93TW9kZWwuZ2V0VG9wTGV2ZWxOb2RlcygpO1xyXG4gICAgcmVjdXJzaXZlbHlTZWxlY3QodG9wTGV2ZWxOb2Rlcyk7XHJcblxyXG4gICAgdGhpcy5zeW5jU2VsZWN0ZWRSb3dzQW5kQ2FsbExpc3RlbmVyKCk7XHJcbn07XHJcblxyXG4vLyBwdWJsaWNcclxuU2VsZWN0aW9uQ29udHJvbGxlci5wcm90b3R5cGUuc2VsZWN0Tm9kZSA9IGZ1bmN0aW9uKG5vZGUsIHRyeU11bHRpLCBzdXBwcmVzc0V2ZW50cykge1xyXG4gICAgdmFyIG11bHRpU2VsZWN0ID0gdGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNSb3dTZWxlY3Rpb25NdWx0aSgpICYmIHRyeU11bHRpO1xyXG5cclxuICAgIC8vIGlmIHRoZSBub2RlIGlzIGEgZ3JvdXAsIHRoZW4gc2VsZWN0aW5nIHRoaXMgaXMgdGhlIHNhbWUgYXMgc2VsZWN0aW5nIHRoZSBwYXJlbnQsXHJcbiAgICAvLyBzbyB0byBoYXZlIG9ubHkgb25lIGZsb3cgdGhyb3VnaCB0aGUgYmVsb3csIHdlIGFsd2F5cyBzZWxlY3QgdGhlIGhlYWRlciBwYXJlbnRcclxuICAgIC8vICh3aGljaCB0aGVuIGhhcyB0aGUgc2lkZSBlZmZlY3Qgb2Ygc2VsZWN0aW5nIHRoZSBjaGlsZCkuXHJcbiAgICB2YXIgbm9kZVRvU2VsZWN0O1xyXG4gICAgaWYgKG5vZGUuZm9vdGVyKSB7XHJcbiAgICAgICAgbm9kZVRvU2VsZWN0ID0gbm9kZS5zaWJsaW5nO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBub2RlVG9TZWxlY3QgPSBub2RlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGF0IHRoZSBlbmQsIGlmIHRoaXMgaXMgdHJ1ZSwgd2UgaW5mb3JtIHRoZSBjYWxsYmFja1xyXG4gICAgdmFyIGF0TGVhc3RPbmVJdGVtVW5zZWxlY3RlZCA9IGZhbHNlO1xyXG4gICAgdmFyIGF0TGVhc3RPbmVJdGVtU2VsZWN0ZWQgPSBmYWxzZTtcclxuXHJcbiAgICAvLyBzZWUgaWYgcm93cyB0byBiZSBkZXNlbGVjdGVkXHJcbiAgICBpZiAoIW11bHRpU2VsZWN0KSB7XHJcbiAgICAgICAgYXRMZWFzdE9uZUl0ZW1VbnNlbGVjdGVkID0gdGhpcy5kb1dvcmtPZkRlc2VsZWN0QWxsTm9kZXMoKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNHcm91cFNlbGVjdHNDaGlsZHJlbigpICYmIG5vZGVUb1NlbGVjdC5ncm91cCkge1xyXG4gICAgICAgIC8vIGRvbid0IHNlbGVjdCB0aGUgZ3JvdXAsIHNlbGVjdCB0aGUgY2hpbGRyZW4gaW5zdGVhZFxyXG4gICAgICAgIGF0TGVhc3RPbmVJdGVtU2VsZWN0ZWQgPSB0aGlzLnJlY3Vyc2l2ZWx5U2VsZWN0QWxsQ2hpbGRyZW4obm9kZVRvU2VsZWN0KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gc2VlIGlmIHJvdyBuZWVkcyB0byBiZSBzZWxlY3RlZFxyXG4gICAgICAgIGF0TGVhc3RPbmVJdGVtU2VsZWN0ZWQgPSB0aGlzLmRvV29ya09mU2VsZWN0Tm9kZShub2RlVG9TZWxlY3QsIHN1cHByZXNzRXZlbnRzKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYXRMZWFzdE9uZUl0ZW1VbnNlbGVjdGVkIHx8IGF0TGVhc3RPbmVJdGVtU2VsZWN0ZWQpIHtcclxuICAgICAgICB0aGlzLnN5bmNTZWxlY3RlZFJvd3NBbmRDYWxsTGlzdGVuZXIoc3VwcHJlc3NFdmVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudXBkYXRlR3JvdXBQYXJlbnRzSWZOZWVkZWQoKTtcclxufTtcclxuXHJcblNlbGVjdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLnJlY3Vyc2l2ZWx5U2VsZWN0QWxsQ2hpbGRyZW4gPSBmdW5jdGlvbihub2RlLCBzdXBwcmVzc0V2ZW50cykge1xyXG4gICAgdmFyIGF0TGVhc3RPbmUgPSBmYWxzZTtcclxuICAgIGlmIChub2RlLmNoaWxkcmVuKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XHJcbiAgICAgICAgICAgIGlmIChjaGlsZC5ncm91cCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVjdXJzaXZlbHlTZWxlY3RBbGxDaGlsZHJlbihjaGlsZCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBhdExlYXN0T25lID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmRvV29ya09mU2VsZWN0Tm9kZShjaGlsZCwgc3VwcHJlc3NFdmVudHMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXRMZWFzdE9uZSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYXRMZWFzdE9uZTtcclxufTtcclxuXHJcblNlbGVjdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLnJlY3Vyc2l2ZWx5RGVzZWxlY3RBbGxDaGlsZHJlbiA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgIGlmIChub2RlLmNoaWxkcmVuKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XHJcbiAgICAgICAgICAgIGlmIChjaGlsZC5ncm91cCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZWN1cnNpdmVseURlc2VsZWN0QWxsQ2hpbGRyZW4oY2hpbGQpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kZXNlbGVjdFJlYWxOb2RlKGNoaWxkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuLy8gMSAtIHNlbGVjdHMgYSBub2RlXHJcbi8vIDIgLSB1cGRhdGVzIHRoZSBVSVxyXG4vLyAzIC0gY2FsbHMgY2FsbGJhY2tzXHJcblNlbGVjdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLmRvV29ya09mU2VsZWN0Tm9kZSA9IGZ1bmN0aW9uKG5vZGUsIHN1cHByZXNzRXZlbnRzKSB7XHJcbiAgICBpZiAodGhpcy5zZWxlY3RlZE5vZGVzQnlJZFtub2RlLmlkXSkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnNlbGVjdGVkTm9kZXNCeUlkW25vZGUuaWRdID0gbm9kZTtcclxuXHJcbiAgICB0aGlzLmFkZENzc0NsYXNzRm9yTm9kZV9hbmRJbmZvcm1WaXJ0dWFsUm93TGlzdGVuZXIobm9kZSk7XHJcblxyXG4gICAgLy8gYWxzbyBjb2xvciBpbiB0aGUgZm9vdGVyIGlmIHRoZXJlIGlzIG9uZVxyXG4gICAgaWYgKG5vZGUuZ3JvdXAgJiYgbm9kZS5leHBhbmRlZCAmJiBub2RlLnNpYmxpbmcpIHtcclxuICAgICAgICB0aGlzLmFkZENzc0NsYXNzRm9yTm9kZV9hbmRJbmZvcm1WaXJ0dWFsUm93TGlzdGVuZXIobm9kZS5zaWJsaW5nKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBpbmZvcm0gdGhlIHJvd1NlbGVjdGVkIGxpc3RlbmVyLCBpZiBhbnlcclxuICAgIGlmICghc3VwcHJlc3NFdmVudHMgJiYgdHlwZW9mIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldFJvd1NlbGVjdGVkKCkgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldFJvd1NlbGVjdGVkKCkobm9kZS5kYXRhLCBub2RlKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuLy8gMSAtIHNlbGVjdHMgYSBub2RlXHJcbi8vIDIgLSB1cGRhdGVzIHRoZSBVSVxyXG4vLyAzIC0gY2FsbHMgY2FsbGJhY2tzXHJcbi8vIHdvdyAtIHdoYXQgYSBiaWcgbmFtZSBmb3IgYSBtZXRob2QsIGV4Y2VwdGlvbiBjYXNlLCBpdCdzIHNheWluZyB3aGF0IHRoZSBtZXRob2QgZG9lc1xyXG5TZWxlY3Rpb25Db250cm9sbGVyLnByb3RvdHlwZS5hZGRDc3NDbGFzc0Zvck5vZGVfYW5kSW5mb3JtVmlydHVhbFJvd0xpc3RlbmVyID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgdmFyIHZpcnR1YWxSZW5kZXJlZFJvd0luZGV4ID0gdGhpcy5yb3dSZW5kZXJlci5nZXRJbmRleE9mUmVuZGVyZWROb2RlKG5vZGUpO1xyXG4gICAgaWYgKHZpcnR1YWxSZW5kZXJlZFJvd0luZGV4ID49IDApIHtcclxuICAgICAgICB1dGlscy5xdWVyeVNlbGVjdG9yQWxsX2FkZENzc0NsYXNzKHRoaXMuZVJvd3NQYXJlbnQsICdbcm93PVwiJyArIHZpcnR1YWxSZW5kZXJlZFJvd0luZGV4ICsgJ1wiXScsICdhZy1yb3ctc2VsZWN0ZWQnKTtcclxuXHJcbiAgICAgICAgLy8gaW5mb3JtIHZpcnR1YWwgcm93IGxpc3RlbmVyXHJcbiAgICAgICAgdGhpcy5hbmd1bGFyR3JpZC5vblZpcnR1YWxSb3dTZWxlY3RlZCh2aXJ0dWFsUmVuZGVyZWRSb3dJbmRleCwgdHJ1ZSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vLyBwcml2YXRlXHJcbi8vIDEgLSB1bi1zZWxlY3RzIGEgbm9kZVxyXG4vLyAyIC0gdXBkYXRlcyB0aGUgVUlcclxuLy8gMyAtIGNhbGxzIGNhbGxiYWNrc1xyXG5TZWxlY3Rpb25Db250cm9sbGVyLnByb3RvdHlwZS5kb1dvcmtPZkRlc2VsZWN0QWxsTm9kZXMgPSBmdW5jdGlvbihub2RlVG9LZWVwU2VsZWN0ZWQpIHtcclxuICAgIC8vIG5vdCBkb2luZyBtdWx0aS1zZWxlY3QsIHNvIGRlc2VsZWN0IGV2ZXJ5dGhpbmcgb3RoZXIgdGhhbiB0aGUgJ2p1c3Qgc2VsZWN0ZWQnIHJvd1xyXG4gICAgdmFyIGF0TGVhc3RPbmVTZWxlY3Rpb25DaGFuZ2U7XHJcbiAgICB2YXIgc2VsZWN0ZWROb2RlS2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuc2VsZWN0ZWROb2Rlc0J5SWQpO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxlY3RlZE5vZGVLZXlzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgLy8gc2tpcCB0aGUgJ2p1c3Qgc2VsZWN0ZWQnIHJvd1xyXG4gICAgICAgIHZhciBrZXkgPSBzZWxlY3RlZE5vZGVLZXlzW2ldO1xyXG4gICAgICAgIHZhciBub2RlVG9EZXNlbGVjdCA9IHRoaXMuc2VsZWN0ZWROb2Rlc0J5SWRba2V5XTtcclxuICAgICAgICBpZiAobm9kZVRvRGVzZWxlY3QgPT09IG5vZGVUb0tlZXBTZWxlY3RlZCkge1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmRlc2VsZWN0UmVhbE5vZGUobm9kZVRvRGVzZWxlY3QpO1xyXG4gICAgICAgICAgICBhdExlYXN0T25lU2VsZWN0aW9uQ2hhbmdlID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYXRMZWFzdE9uZVNlbGVjdGlvbkNoYW5nZTtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuU2VsZWN0aW9uQ29udHJvbGxlci5wcm90b3R5cGUuZGVzZWxlY3RSZWFsTm9kZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgIC8vIGRlc2VsZWN0IHRoZSBjc3NcclxuICAgIHRoaXMucmVtb3ZlQ3NzQ2xhc3NGb3JOb2RlKG5vZGUpO1xyXG5cclxuICAgIC8vIGlmIG5vZGUgaXMgYSBoZWFkZXIsIGFuZCBpZiBpdCBoYXMgYSBzaWJsaW5nIGZvb3RlciwgZGVzZWxlY3QgdGhlIGZvb3RlciBhbHNvXHJcbiAgICBpZiAobm9kZS5ncm91cCAmJiBub2RlLmV4cGFuZGVkICYmIG5vZGUuc2libGluZykgeyAvLyBhbHNvIGNoZWNrIHRoYXQgaXQncyBleHBhbmRlZCwgYXMgc2libGluZyBjb3VsZCBiZSBhIGdob3N0XHJcbiAgICAgICAgdGhpcy5yZW1vdmVDc3NDbGFzc0Zvck5vZGUobm9kZS5zaWJsaW5nKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyByZW1vdmUgdGhlIHJvd1xyXG4gICAgZGVsZXRlIHRoaXMuc2VsZWN0ZWROb2Rlc0J5SWRbbm9kZS5pZF07XHJcbn07XHJcblxyXG4vLyBwcml2YXRlXHJcblNlbGVjdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLnJlbW92ZUNzc0NsYXNzRm9yTm9kZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgIHZhciB2aXJ0dWFsUmVuZGVyZWRSb3dJbmRleCA9IHRoaXMucm93UmVuZGVyZXIuZ2V0SW5kZXhPZlJlbmRlcmVkTm9kZShub2RlKTtcclxuICAgIGlmICh2aXJ0dWFsUmVuZGVyZWRSb3dJbmRleCA+PSAwKSB7XHJcbiAgICAgICAgdXRpbHMucXVlcnlTZWxlY3RvckFsbF9yZW1vdmVDc3NDbGFzcyh0aGlzLmVSb3dzUGFyZW50LCAnW3Jvdz1cIicgKyB2aXJ0dWFsUmVuZGVyZWRSb3dJbmRleCArICdcIl0nLCAnYWctcm93LXNlbGVjdGVkJyk7XHJcbiAgICAgICAgLy8gaW5mb3JtIHZpcnR1YWwgcm93IGxpc3RlbmVyXHJcbiAgICAgICAgdGhpcy5hbmd1bGFyR3JpZC5vblZpcnR1YWxSb3dTZWxlY3RlZCh2aXJ0dWFsUmVuZGVyZWRSb3dJbmRleCwgZmFsc2UpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLy8gcHVibGljIChzZWxlY3Rpb25SZW5kZXJlckZhY3RvcnkpXHJcblNlbGVjdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLmRlc2VsZWN0SW5kZXggPSBmdW5jdGlvbihyb3dJbmRleCkge1xyXG4gICAgdmFyIG5vZGUgPSB0aGlzLnJvd01vZGVsLmdldFZpcnR1YWxSb3cocm93SW5kZXgpO1xyXG4gICAgdGhpcy5kZXNlbGVjdE5vZGUobm9kZSk7XHJcbn07XHJcblxyXG4vLyBwdWJsaWMgKGFwaSlcclxuU2VsZWN0aW9uQ29udHJvbGxlci5wcm90b3R5cGUuZGVzZWxlY3ROb2RlID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgaWYgKG5vZGUpIHtcclxuICAgICAgICBpZiAodGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNHcm91cFNlbGVjdHNDaGlsZHJlbigpICYmIG5vZGUuZ3JvdXApIHtcclxuICAgICAgICAgICAgLy8gd2FudCB0byBkZXNlbGVjdCBjaGlsZHJlbiwgbm90IHRoaXMgbm9kZSwgc28gcmVjdXJzaXZlbHkgZGVzZWxlY3RcclxuICAgICAgICAgICAgdGhpcy5yZWN1cnNpdmVseURlc2VsZWN0QWxsQ2hpbGRyZW4obm9kZSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5kZXNlbGVjdFJlYWxOb2RlKG5vZGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHRoaXMuc3luY1NlbGVjdGVkUm93c0FuZENhbGxMaXN0ZW5lcigpO1xyXG4gICAgdGhpcy51cGRhdGVHcm91cFBhcmVudHNJZk5lZWRlZCgpO1xyXG59O1xyXG5cclxuLy8gcHVibGljIChzZWxlY3Rpb25SZW5kZXJlckZhY3RvcnkgJiBhcGkpXHJcblNlbGVjdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLnNlbGVjdEluZGV4ID0gZnVuY3Rpb24oaW5kZXgsIHRyeU11bHRpLCBzdXBwcmVzc0V2ZW50cykge1xyXG4gICAgdmFyIG5vZGUgPSB0aGlzLnJvd01vZGVsLmdldFZpcnR1YWxSb3coaW5kZXgpO1xyXG4gICAgdGhpcy5zZWxlY3ROb2RlKG5vZGUsIHRyeU11bHRpLCBzdXBwcmVzc0V2ZW50cyk7XHJcbn07XHJcblxyXG4vLyBwcml2YXRlXHJcbi8vIHVwZGF0ZXMgdGhlIHNlbGVjdGVkUm93cyB3aXRoIHRoZSBzZWxlY3RlZE5vZGVzIGFuZCBjYWxscyBzZWxlY3Rpb25DaGFuZ2VkIGxpc3RlbmVyXHJcblNlbGVjdGlvbkNvbnRyb2xsZXIucHJvdG90eXBlLnN5bmNTZWxlY3RlZFJvd3NBbmRDYWxsTGlzdGVuZXIgPSBmdW5jdGlvbihzdXBwcmVzc0V2ZW50cykge1xyXG4gICAgLy8gdXBkYXRlIHNlbGVjdGVkIHJvd3NcclxuICAgIHZhciBzZWxlY3RlZFJvd3MgPSB0aGlzLnNlbGVjdGVkUm93cztcclxuICAgIHZhciBvbGRDb3VudCA9IHNlbGVjdGVkUm93cy5sZW5ndGg7XHJcbiAgICAvLyBjbGVhciBzZWxlY3RlZCByb3dzXHJcbiAgICBzZWxlY3RlZFJvd3MubGVuZ3RoID0gMDtcclxuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModGhpcy5zZWxlY3RlZE5vZGVzQnlJZCk7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBpZiAodGhpcy5zZWxlY3RlZE5vZGVzQnlJZFtrZXlzW2ldXSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHZhciBzZWxlY3RlZE5vZGUgPSB0aGlzLnNlbGVjdGVkTm9kZXNCeUlkW2tleXNbaV1dO1xyXG4gICAgICAgICAgICBzZWxlY3RlZFJvd3MucHVzaChzZWxlY3RlZE5vZGUuZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIHRoaXMgc3RvcGUgdGhlIGV2ZW50IGZpcmluZyB0aGUgdmVyeSBmaXJzdCB0aGUgdGltZSBncmlkIGlzIGluaXRpYWxpc2VkLiB3aXRob3V0IHRoaXMsIHRoZSBkb2N1bWVudGF0aW9uXHJcbiAgICAvLyBwYWdlIGhhZCBhIHBvcHVwIGluIHRoZSAnc2VsZWN0aW9uJyBwYWdlIGFzIHNvb24gYXMgdGhlIHBhZ2Ugd2FzIGxvYWRlZCEhXHJcbiAgICB2YXIgbm90aGluZ0NoYW5nZWRNdXN0QmVJbml0aWFsaXNpbmcgPSBvbGRDb3VudCA9PT0gMCAmJiBzZWxlY3RlZFJvd3MubGVuZ3RoID09PSAwO1xyXG5cclxuICAgIGlmICghbm90aGluZ0NoYW5nZWRNdXN0QmVJbml0aWFsaXNpbmcgJiYgIXN1cHByZXNzRXZlbnRzICYmIHR5cGVvZiB0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5nZXRTZWxlY3Rpb25DaGFuZ2VkKCkgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgIHRoaXMuZ3JpZE9wdGlvbnNXcmFwcGVyLmdldFNlbGVjdGlvbkNoYW5nZWQoKSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhhdC4kc2NvcGUuJGFwcGx5KCk7XHJcbiAgICB9LCAwKTtcclxufTtcclxuXHJcbi8vIHByaXZhdGVcclxuU2VsZWN0aW9uQ29udHJvbGxlci5wcm90b3R5cGUucmVjdXJzaXZlbHlDaGVja0lmU2VsZWN0ZWQgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICB2YXIgZm91bmRTZWxlY3RlZCA9IGZhbHNlO1xyXG4gICAgdmFyIGZvdW5kVW5zZWxlY3RlZCA9IGZhbHNlO1xyXG5cclxuICAgIGlmIChub2RlLmNoaWxkcmVuKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XHJcbiAgICAgICAgICAgIHZhciByZXN1bHQ7XHJcbiAgICAgICAgICAgIGlmIChjaGlsZC5ncm91cCkge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy5yZWN1cnNpdmVseUNoZWNrSWZTZWxlY3RlZChjaGlsZCk7XHJcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgU0VMRUNURUQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvdW5kU2VsZWN0ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIFVOU0VMRUNURUQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvdW5kVW5zZWxlY3RlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTUlYRUQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvdW5kU2VsZWN0ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3VuZFVuc2VsZWN0ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2UgY2FuIGlnbm9yZSB0aGUgRE9fTk9UX0NBUkUsIGFzIGl0IGRvZXNuJ3QgaW1wYWN0LCBtZWFucyB0aGUgY2hpbGRcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaGFzIG5vIGNoaWxkcmVuIGFuZCBzaG91bGRuJ3QgYmUgY29uc2lkZXJlZCB3aGVuIGRlY2lkaW5nXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5pc05vZGVTZWxlY3RlZChjaGlsZCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3VuZFNlbGVjdGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm91bmRVbnNlbGVjdGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGZvdW5kU2VsZWN0ZWQgJiYgZm91bmRVbnNlbGVjdGVkKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBpZiBtaXhlZCwgdGhlbiBubyBuZWVkIHRvIGdvIGZ1cnRoZXIsIGp1c3QgcmV0dXJuIHVwIHRoZSBjaGFpblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIE1JWEVEO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIGdvdCB0aGlzIGZhciwgc28gbm8gY29uZmxpY3RzLCBlaXRoZXIgYWxsIGNoaWxkcmVuIHNlbGVjdGVkLCB1bnNlbGVjdGVkLCBvciBuZWl0aGVyXHJcbiAgICBpZiAoZm91bmRTZWxlY3RlZCkge1xyXG4gICAgICAgIHJldHVybiBTRUxFQ1RFRDtcclxuICAgIH0gZWxzZSBpZiAoZm91bmRVbnNlbGVjdGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIFVOU0VMRUNURUQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBET19OT1RfQ0FSRTtcclxuICAgIH1cclxufTtcclxuXHJcbi8vIHB1YmxpYyAoc2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5KVxyXG4vLyByZXR1cm5zOlxyXG4vLyB0cnVlOiBpZiBzZWxlY3RlZFxyXG4vLyBmYWxzZTogaWYgdW5zZWxlY3RlZFxyXG4vLyB1bmRlZmluZWQ6IGlmIGl0J3MgYSBncm91cCBhbmQgJ2NoaWxkcmVuIHNlbGVjdGlvbicgaXMgdXNlZCBhbmQgJ2NoaWxkcmVuJyBhcmUgYSBtaXggb2Ygc2VsZWN0ZWQgYW5kIHVuc2VsZWN0ZWRcclxuU2VsZWN0aW9uQ29udHJvbGxlci5wcm90b3R5cGUuaXNOb2RlU2VsZWN0ZWQgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICBpZiAodGhpcy5ncmlkT3B0aW9uc1dyYXBwZXIuaXNHcm91cFNlbGVjdHNDaGlsZHJlbigpICYmIG5vZGUuZ3JvdXApIHtcclxuICAgICAgICAvLyBkb2luZyBjaGlsZCBzZWxlY3Rpb24sIHdlIG5lZWQgdG8gdHJhdmVyc2UgdGhlIGNoaWxkcmVuXHJcbiAgICAgICAgdmFyIHJlc3VsdE9mQ2hpbGRyZW4gPSB0aGlzLnJlY3Vyc2l2ZWx5Q2hlY2tJZlNlbGVjdGVkKG5vZGUpO1xyXG4gICAgICAgIHN3aXRjaCAocmVzdWx0T2ZDaGlsZHJlbikge1xyXG4gICAgICAgICAgICBjYXNlIFNFTEVDVEVEOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIGNhc2UgVU5TRUxFQ1RFRDpcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZWxlY3RlZE5vZGVzQnlJZFtub2RlLmlkXSAhPT0gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG59O1xyXG5cclxuU2VsZWN0aW9uQ29udHJvbGxlci5wcm90b3R5cGUudXBkYXRlR3JvdXBQYXJlbnRzSWZOZWVkZWQgPSBmdW5jdGlvbigpIHtcclxuICAgIC8vIHdlIG9ubHkgZG8gdGhpcyBpZiBwYXJlbnQgbm9kZXMgYXJlIHJlc3BvbnNpYmxlXHJcbiAgICAvLyBmb3Igc2VsZWN0aW5nIHRoZWlyIGNoaWxkcmVuLlxyXG4gICAgaWYgKCF0aGlzLmdyaWRPcHRpb25zV3JhcHBlci5pc0dyb3VwU2VsZWN0c0NoaWxkcmVuKCkpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGZpcnN0Um93ID0gdGhpcy5yb3dSZW5kZXJlci5nZXRGaXJzdFZpcnR1YWxSZW5kZXJlZFJvdygpO1xyXG4gICAgdmFyIGxhc3RSb3cgPSB0aGlzLnJvd1JlbmRlcmVyLmdldExhc3RWaXJ0dWFsUmVuZGVyZWRSb3coKTtcclxuICAgIGZvciAodmFyIHJvd0luZGV4ID0gZmlyc3RSb3c7IHJvd0luZGV4IDw9IGxhc3RSb3c7IHJvd0luZGV4KyspIHtcclxuICAgICAgICAvLyBzZWUgaWYgbm9kZSBpcyBhIGdyb3VwXHJcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLnJvd01vZGVsLmdldFZpcnR1YWxSb3cocm93SW5kZXgpO1xyXG4gICAgICAgIGlmIChub2RlLmdyb3VwKSB7XHJcbiAgICAgICAgICAgIHZhciBzZWxlY3RlZCA9IHRoaXMuaXNOb2RlU2VsZWN0ZWQobm9kZSk7XHJcbiAgICAgICAgICAgIHRoaXMuYW5ndWxhckdyaWQub25WaXJ0dWFsUm93U2VsZWN0ZWQocm93SW5kZXgsIHNlbGVjdGVkKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChzZWxlY3RlZCkge1xyXG4gICAgICAgICAgICAgICAgdXRpbHMucXVlcnlTZWxlY3RvckFsbF9hZGRDc3NDbGFzcyh0aGlzLmVSb3dzUGFyZW50LCAnW3Jvdz1cIicgKyByb3dJbmRleCArICdcIl0nLCAnYWctcm93LXNlbGVjdGVkJyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB1dGlscy5xdWVyeVNlbGVjdG9yQWxsX3JlbW92ZUNzc0NsYXNzKHRoaXMuZVJvd3NQYXJlbnQsICdbcm93PVwiJyArIHJvd0luZGV4ICsgJ1wiXScsICdhZy1yb3ctc2VsZWN0ZWQnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2VsZWN0aW9uQ29udHJvbGxlcjtcclxuIiwiZnVuY3Rpb24gU2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5KCkge31cclxuXHJcblNlbGVjdGlvblJlbmRlcmVyRmFjdG9yeS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKGFuZ3VsYXJHcmlkLCBzZWxlY3Rpb25Db250cm9sbGVyKSB7XHJcbiAgICB0aGlzLmFuZ3VsYXJHcmlkID0gYW5ndWxhckdyaWQ7XHJcbiAgICB0aGlzLnNlbGVjdGlvbkNvbnRyb2xsZXIgPSBzZWxlY3Rpb25Db250cm9sbGVyO1xyXG59O1xyXG5cclxuU2VsZWN0aW9uUmVuZGVyZXJGYWN0b3J5LnByb3RvdHlwZS5jcmVhdGVDaGVja2JveENvbERlZiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB3aWR0aDogMzAsXHJcbiAgICAgICAgc3VwcHJlc3NNZW51OiB0cnVlLFxyXG4gICAgICAgIHN1cHByZXNzU29ydGluZzogdHJ1ZSxcclxuICAgICAgICBoZWFkZXJDZWxsUmVuZGVyZXI6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB2YXIgZUNoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICAgICAgICAgICAgZUNoZWNrYm94LnR5cGUgPSAnY2hlY2tib3gnO1xyXG4gICAgICAgICAgICBlQ2hlY2tib3gubmFtZSA9ICduYW1lJztcclxuICAgICAgICAgICAgcmV0dXJuIGVDaGVja2JveDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNlbGxSZW5kZXJlcjogdGhpcy5jcmVhdGVDaGVja2JveFJlbmRlcmVyKClcclxuICAgIH07XHJcbn07XHJcblxyXG5TZWxlY3Rpb25SZW5kZXJlckZhY3RvcnkucHJvdG90eXBlLmNyZWF0ZUNoZWNrYm94UmVuZGVyZXIgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIHJldHVybiBmdW5jdGlvbihwYXJhbXMpIHtcclxuICAgICAgICByZXR1cm4gdGhhdC5jcmVhdGVTZWxlY3Rpb25DaGVja2JveChwYXJhbXMubm9kZSwgcGFyYW1zLnJvd0luZGV4KTtcclxuICAgIH07XHJcbn07XHJcblxyXG5TZWxlY3Rpb25SZW5kZXJlckZhY3RvcnkucHJvdG90eXBlLmNyZWF0ZVNlbGVjdGlvbkNoZWNrYm94ID0gZnVuY3Rpb24obm9kZSwgcm93SW5kZXgpIHtcclxuXHJcbiAgICB2YXIgZUNoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICAgIGVDaGVja2JveC50eXBlID0gXCJjaGVja2JveFwiO1xyXG4gICAgZUNoZWNrYm94Lm5hbWUgPSBcIm5hbWVcIjtcclxuICAgIGVDaGVja2JveC5jbGFzc05hbWUgPSAnYWctc2VsZWN0aW9uLWNoZWNrYm94JztcclxuICAgIHNldENoZWNrYm94U3RhdGUoZUNoZWNrYm94LCB0aGlzLnNlbGVjdGlvbkNvbnRyb2xsZXIuaXNOb2RlU2VsZWN0ZWQobm9kZSkpO1xyXG5cclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIGVDaGVja2JveC5vbmNsaWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIH07XHJcblxyXG4gICAgZUNoZWNrYm94Lm9uY2hhbmdlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIG5ld1ZhbHVlID0gZUNoZWNrYm94LmNoZWNrZWQ7XHJcbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XHJcbiAgICAgICAgICAgIHRoYXQuc2VsZWN0aW9uQ29udHJvbGxlci5zZWxlY3RJbmRleChyb3dJbmRleCwgdHJ1ZSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhhdC5zZWxlY3Rpb25Db250cm9sbGVyLmRlc2VsZWN0SW5kZXgocm93SW5kZXgpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5hbmd1bGFyR3JpZC5hZGRWaXJ0dWFsUm93TGlzdGVuZXIocm93SW5kZXgsIHtcclxuICAgICAgICByb3dTZWxlY3RlZDogZnVuY3Rpb24oc2VsZWN0ZWQpIHtcclxuICAgICAgICAgICAgc2V0Q2hlY2tib3hTdGF0ZShlQ2hlY2tib3gsIHNlbGVjdGVkKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJvd1JlbW92ZWQ6IGZ1bmN0aW9uKCkge31cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBlQ2hlY2tib3g7XHJcbn07XHJcblxyXG5mdW5jdGlvbiBzZXRDaGVja2JveFN0YXRlKGVDaGVja2JveCwgc3RhdGUpIHtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgIGVDaGVja2JveC5jaGVja2VkID0gc3RhdGU7XHJcbiAgICAgICAgZUNoZWNrYm94LmluZGV0ZXJtaW5hdGUgPSBmYWxzZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gaXNOb2RlU2VsZWN0ZWQgcmV0dXJucyBiYWNrIHVuZGVmaW5lZCBpZiBpdCdzIGEgZ3JvdXAgYW5kIHRoZSBjaGlsZHJlblxyXG4gICAgICAgIC8vIGFyZSBhIG1peCBvZiBzZWxlY3RlZCBhbmQgdW5zZWxlY3RlZFxyXG4gICAgICAgIGVDaGVja2JveC5pbmRldGVybWluYXRlID0gdHJ1ZTtcclxuICAgIH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTZWxlY3Rpb25SZW5kZXJlckZhY3Rvcnk7XHJcbiIsInZhciBTVkdfTlMgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI7XHJcblxyXG5mdW5jdGlvbiBTdmdGYWN0b3J5KCkge31cclxuXHJcblN2Z0ZhY3RvcnkucHJvdG90eXBlLmNyZWF0ZUZpbHRlclN2ZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGVTdmcgPSBjcmVhdGVJY29uU3ZnKCk7XHJcblxyXG4gICAgdmFyIGVGdW5uZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05TLCBcInBvbHlnb25cIik7XHJcbiAgICBlRnVubmVsLnNldEF0dHJpYnV0ZShcInBvaW50c1wiLCBcIjAsMCA0LDQgNCwxMCA2LDEwIDYsNCAxMCwwXCIpO1xyXG4gICAgZUZ1bm5lbC5zZXRBdHRyaWJ1dGUoXCJjbGFzc1wiLCBcImFnLWhlYWRlci1pY29uXCIpO1xyXG4gICAgZVN2Zy5hcHBlbmRDaGlsZChlRnVubmVsKTtcclxuXHJcbiAgICByZXR1cm4gZVN2ZztcclxufTtcclxuXHJcblN2Z0ZhY3RvcnkucHJvdG90eXBlLmNyZWF0ZU1lbnVTdmcgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBlU3ZnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OUywgXCJzdmdcIik7XHJcbiAgICB2YXIgc2l6ZSA9IFwiMTJcIjtcclxuICAgIGVTdmcuc2V0QXR0cmlidXRlKFwid2lkdGhcIiwgc2l6ZSk7XHJcbiAgICBlU3ZnLnNldEF0dHJpYnV0ZShcImhlaWdodFwiLCBzaXplKTtcclxuXHJcbiAgICBbXCIwXCIsIFwiNVwiLCBcIjEwXCJdLmZvckVhY2goZnVuY3Rpb24oeSkge1xyXG4gICAgICAgIHZhciBlTGluZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhTVkdfTlMsIFwicmVjdFwiKTtcclxuICAgICAgICBlTGluZS5zZXRBdHRyaWJ1dGUoXCJ5XCIsIHkpO1xyXG4gICAgICAgIGVMaW5lLnNldEF0dHJpYnV0ZShcIndpZHRoXCIsIHNpemUpO1xyXG4gICAgICAgIGVMaW5lLnNldEF0dHJpYnV0ZShcImhlaWdodFwiLCBcIjJcIik7XHJcbiAgICAgICAgZUxpbmUuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgXCJhZy1oZWFkZXItaWNvblwiKTtcclxuICAgICAgICBlU3ZnLmFwcGVuZENoaWxkKGVMaW5lKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBlU3ZnO1xyXG59O1xyXG5cclxuU3ZnRmFjdG9yeS5wcm90b3R5cGUuY3JlYXRlQXJyb3dVcFN2ZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIGNyZWF0ZVBvbHlnb25TdmcoXCIwLDEwIDUsMCAxMCwxMFwiKTtcclxufTtcclxuXHJcblN2Z0ZhY3RvcnkucHJvdG90eXBlLmNyZWF0ZUFycm93TGVmdFN2ZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIGNyZWF0ZVBvbHlnb25TdmcoXCIxMCwwIDAsNSAxMCwxMFwiKTtcclxufTtcclxuXHJcblN2Z0ZhY3RvcnkucHJvdG90eXBlLmNyZWF0ZUFycm93RG93blN2ZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIGNyZWF0ZVBvbHlnb25TdmcoXCIwLDAgNSwxMCAxMCwwXCIpO1xyXG59O1xyXG5cclxuU3ZnRmFjdG9yeS5wcm90b3R5cGUuY3JlYXRlQXJyb3dSaWdodFN2ZyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIGNyZWF0ZVBvbHlnb25TdmcoXCIwLDAgMTAsNSAwLDEwXCIpO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gY3JlYXRlUG9seWdvblN2Zyhwb2ludHMpIHtcclxuICAgIHZhciBlU3ZnID0gY3JlYXRlSWNvblN2ZygpO1xyXG5cclxuICAgIHZhciBlRGVzY0ljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05TLCBcInBvbHlnb25cIik7XHJcbiAgICBlRGVzY0ljb24uc2V0QXR0cmlidXRlKFwicG9pbnRzXCIsIHBvaW50cyk7XHJcbiAgICBlU3ZnLmFwcGVuZENoaWxkKGVEZXNjSWNvbik7XHJcblxyXG4gICAgcmV0dXJuIGVTdmc7XHJcbn1cclxuXHJcbi8vIHV0aWwgZnVuY3Rpb24gZm9yIHRoZSBhYm92ZVxyXG5mdW5jdGlvbiBjcmVhdGVJY29uU3ZnKCkge1xyXG4gICAgdmFyIGVTdmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoU1ZHX05TLCBcInN2Z1wiKTtcclxuICAgIGVTdmcuc2V0QXR0cmlidXRlKFwid2lkdGhcIiwgXCIxMFwiKTtcclxuICAgIGVTdmcuc2V0QXR0cmlidXRlKFwiaGVpZ2h0XCIsIFwiMTBcIik7XHJcbiAgICByZXR1cm4gZVN2ZztcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTdmdGYWN0b3J5O1xyXG4iLCJ2YXIgdGVtcGxhdGUgPSBbXHJcbiAgICAnPGRpdiBjbGFzcz1cImFnLXJvb3QgYWctc2Nyb2xsc1wiPicsXHJcbiAgICAnICAgIDwhLS0gVGhlIGxvYWRpbmcgcGFuZWwgLS0+JyxcclxuICAgICcgICAgPCEtLSB3cmFwcGluZyBpbiBvdXRlciBkaXYsIGFuZCB3cmFwcGVyLCBpcyBuZWVkZWQgdG8gY2VudGVyIHRoZSBsb2FkaW5nIGljb24gLS0+JyxcclxuICAgICcgICAgPCEtLSBUaGUgaWRlYSBmb3IgY2VudGVyaW5nIGNhbWUgZnJvbSBoZXJlOiBodHRwOi8vd3d3LnZhbnNlb2Rlc2lnbi5jb20vY3NzL3ZlcnRpY2FsLWNlbnRlcmluZy8gLS0+JyxcclxuICAgICcgICAgPGRpdiBjbGFzcz1cImFnLWxvYWRpbmctcGFuZWxcIj4nLFxyXG4gICAgJyAgICAgICAgPGRpdiBjbGFzcz1cImFnLWxvYWRpbmctd3JhcHBlclwiPicsXHJcbiAgICAnICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJhZy1sb2FkaW5nLWNlbnRlclwiPkxvYWRpbmcuLi48L3NwYW4+JyxcclxuICAgICcgICAgICAgIDwvZGl2PicsXHJcbiAgICAnICAgIDwvZGl2PicsXHJcbiAgICAnICAgIDwhLS0gaGVhZGVyIC0tPicsXHJcbiAgICAnICAgIDxkaXYgY2xhc3M9XCJhZy1oZWFkZXJcIj4nLFxyXG4gICAgJyAgICAgICAgPGRpdiBjbGFzcz1cImFnLXBpbm5lZC1oZWFkZXJcIj48L2Rpdj48ZGl2IGNsYXNzPVwiYWctaGVhZGVyLXZpZXdwb3J0XCI+PGRpdiBjbGFzcz1cImFnLWhlYWRlci1jb250YWluZXJcIj48L2Rpdj48L2Rpdj4nLFxyXG4gICAgJyAgICA8L2Rpdj4nLFxyXG4gICAgJyAgICA8IS0tIGJvZHkgLS0+JyxcclxuICAgICcgICAgPGRpdiBjbGFzcz1cImFnLWJvZHlcIj4nLFxyXG4gICAgJyAgICAgICAgPGRpdiBjbGFzcz1cImFnLXBpbm5lZC1jb2xzLXZpZXdwb3J0XCI+JyxcclxuICAgICcgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWctcGlubmVkLWNvbHMtY29udGFpbmVyXCI+PC9kaXY+JyxcclxuICAgICcgICAgICAgIDwvZGl2PicsXHJcbiAgICAnICAgICAgICA8ZGl2IGNsYXNzPVwiYWctYm9keS12aWV3cG9ydC13cmFwcGVyXCI+JyxcclxuICAgICcgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYWctYm9keS12aWV3cG9ydFwiPicsXHJcbiAgICAnICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJhZy1ib2R5LWNvbnRhaW5lclwiPjwvZGl2PicsXHJcbiAgICAnICAgICAgICAgICAgPC9kaXY+JyxcclxuICAgICcgICAgICAgIDwvZGl2PicsXHJcbiAgICAnICAgIDwvZGl2PicsXHJcbiAgICAnICAgIDwhLS0gUGFnaW5nIC0tPicsXHJcbiAgICAnICAgIDxkaXYgY2xhc3M9XCJhZy1wYWdpbmctcGFuZWxcIj4nLFxyXG4gICAgJyAgICA8L2Rpdj4nLFxyXG4gICAgJyAgICA8L2Rpdj4nXHJcbl0uam9pbignJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlO1xyXG4iLCJ2YXIgdGVtcGxhdGUgPSBbXHJcbiAgICAnPGRpdiBjbGFzcz1cImFnLXJvb3QgYWctbm8tc2Nyb2xsc1wiPicsXHJcbiAgICAnICAgIDwhLS0gU2VlIGNvbW1lbnQgaW4gdGVtcGxhdGUuaHRtbCBmb3Igd2h5IGxvYWRpbmcgaXMgbGFpZCBvdXQgbGlrZSBzbyAtLT4nLFxyXG4gICAgJyAgICA8ZGl2IGNsYXNzPVwiYWctbG9hZGluZy1wYW5lbFwiPicsXHJcbiAgICAnICAgICAgICA8ZGl2IGNsYXNzPVwiYWctbG9hZGluZy13cmFwcGVyXCI+JyxcclxuICAgICcgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImFnLWxvYWRpbmctY2VudGVyXCI+TG9hZGluZy4uLjwvc3Bhbj4nLFxyXG4gICAgJyAgICAgICAgPC9kaXY+JyxcclxuICAgICcgICAgPC9kaXY+JyxcclxuICAgICcgICAgPCEtLSBoZWFkZXIgLS0+JyxcclxuICAgICcgICAgPGRpdiBjbGFzcz1cImFnLWhlYWRlci1jb250YWluZXJcIj48L2Rpdj4nLFxyXG4gICAgJyAgICA8IS0tIGJvZHkgLS0+JyxcclxuICAgICcgICAgPGRpdiBjbGFzcz1cImFnLWJvZHktY29udGFpbmVyXCI+PC9kaXY+JyxcclxuICAgICc8L2Rpdj4nXHJcbl0uam9pbignJyk7XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZTtcclxuIiwiXHJcbmZ1bmN0aW9uIFRlbXBsYXRlU2VydmljZSgpIHtcclxuICAgIHRoaXMudGVtcGxhdGVDYWNoZSA9IHt9O1xyXG4gICAgdGhpcy53YWl0aW5nQ2FsbGJhY2tzID0ge307XHJcbn1cclxuXHJcblRlbXBsYXRlU2VydmljZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uICgkc2NvcGUpIHtcclxuICAgIHRoaXMuJHNjb3BlID0gJHNjb3BlO1xyXG59O1xyXG5cclxuLy8gcmV0dXJucyB0aGUgdGVtcGxhdGUgaWYgaXQgaXMgbG9hZGVkLCBvciBudWxsIGlmIGl0IGlzIG5vdCBsb2FkZWRcclxuLy8gYnV0IHdpbGwgY2FsbCB0aGUgY2FsbGJhY2sgd2hlbiBpdCBpcyBsb2FkZWRcclxuVGVtcGxhdGVTZXJ2aWNlLnByb3RvdHlwZS5nZXRUZW1wbGF0ZSA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XHJcblxyXG4gICAgdmFyIHRlbXBsYXRlRnJvbUNhY2hlID0gdGhpcy50ZW1wbGF0ZUNhY2hlW3VybF07XHJcbiAgICBpZiAodGVtcGxhdGVGcm9tQ2FjaGUpIHtcclxuICAgICAgICByZXR1cm4gdGVtcGxhdGVGcm9tQ2FjaGU7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGNhbGxiYWNrTGlzdCA9IHRoaXMud2FpdGluZ0NhbGxiYWNrc1t1cmxdO1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgaWYgKCFjYWxsYmFja0xpc3QpIHtcclxuICAgICAgICAvLyBmaXJzdCB0aW1lIHRoaXMgd2FzIGNhbGxlZCwgc28gbmVlZCBhIG5ldyBsaXN0IGZvciBjYWxsYmFja3NcclxuICAgICAgICBjYWxsYmFja0xpc3QgPSBbXTtcclxuICAgICAgICB0aGlzLndhaXRpbmdDYWxsYmFja3NbdXJsXSA9IGNhbGxiYWNrTGlzdDtcclxuICAgICAgICAvLyBhbmQgYWxzbyBuZWVkIHRvIGRvIHRoZSBodHRwIHJlcXVlc3RcclxuICAgICAgICB2YXIgY2xpZW50ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICAgICAgY2xpZW50Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHsgdGhhdC5oYW5kbGVIdHRwUmVzdWx0KHRoaXMsIHVybCk7IH07XHJcbiAgICAgICAgY2xpZW50Lm9wZW4oXCJHRVRcIiwgdXJsKTtcclxuICAgICAgICBjbGllbnQuc2VuZCgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGFkZCB0aGlzIGNhbGxiYWNrXHJcbiAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICBjYWxsYmFja0xpc3QucHVzaChjYWxsYmFjayk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gY2FsbGVyIG5lZWRzIHRvIHdhaXQgZm9yIHRlbXBsYXRlIHRvIGxvYWQsIHNvIHJldHVybiBudWxsXHJcbiAgICByZXR1cm4gbnVsbDtcclxufTtcclxuXHJcblRlbXBsYXRlU2VydmljZS5wcm90b3R5cGUuaGFuZGxlSHR0cFJlc3VsdCA9IGZ1bmN0aW9uIChodHRwUmVzdWx0LCB1cmwpIHtcclxuXHJcbiAgICBpZiAoaHR0cFJlc3VsdC5zdGF0dXMgIT09IDIwMCB8fCBodHRwUmVzdWx0LnJlc3BvbnNlID09PSBudWxsKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1VuYWJsZSB0byBnZXQgdGVtcGxhdGUgZXJyb3IgJyArIGh0dHBSZXN1bHQuc3RhdHVzICsgJyAtICcgKyB1cmwpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyByZXNwb25zZSBzdWNjZXNzLCBzbyBwcm9jZXNzIGl0XHJcbiAgICB0aGlzLnRlbXBsYXRlQ2FjaGVbdXJsXSA9IGh0dHBSZXN1bHQucmVzcG9uc2U7XHJcblxyXG4gICAgLy8gaW5mb3JtIGFsbCBsaXN0ZW5lcnMgdGhhdCB0aGlzIGlzIG5vdyBpbiB0aGUgY2FjaGVcclxuICAgIHZhciBjYWxsYmFja3MgPSB0aGlzLndhaXRpbmdDYWxsYmFja3NbdXJsXTtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gY2FsbGJhY2tzW2ldO1xyXG4gICAgICAgIC8vIHdlIGNvdWxkIHBhc3MgdGhlIGNhbGxiYWNrIHRoZSByZXNwb25zZSwgaG93ZXZlciB3ZSBrbm93IHRoZSBjbGllbnQgb2YgdGhpcyBjb2RlXHJcbiAgICAgICAgLy8gaXMgdGhlIGNlbGwgcmVuZGVyZXIsIGFuZCBpdCBwYXNzZXMgdGhlICdjZWxsUmVmcmVzaCcgbWV0aG9kIGluIGFzIHRoZSBjYWxsYmFja1xyXG4gICAgICAgIC8vIHdoaWNoIGRvZXNuJ3QgdGFrZSBhbnkgcGFyYW1ldGVycy5cclxuICAgICAgICBjYWxsYmFjaygpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLiRzY29wZSkge1xyXG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB0aGF0LiRzY29wZS4kYXBwbHkoKTtcclxuICAgICAgICB9LCAwKTtcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gVGVtcGxhdGVTZXJ2aWNlO1xyXG4iLCJmdW5jdGlvbiBVdGlscygpIHt9XHJcblxyXG5cclxuVXRpbHMucHJvdG90eXBlLmdldFZhbHVlID0gZnVuY3Rpb24oZXhwcmVzc2lvblNlcnZpY2UsIGRhdGEsIGNvbERlZiwgbm9kZSwgYXBpLCBjb250ZXh0KSB7XHJcblxyXG4gICAgdmFyIHZhbHVlR2V0dGVyID0gY29sRGVmLnZhbHVlR2V0dGVyO1xyXG4gICAgdmFyIGZpZWxkID0gY29sRGVmLmZpZWxkO1xyXG5cclxuICAgIC8vIGlmIHRoZXJlIGlzIGEgdmFsdWUgZ2V0dGVyLCB0aGlzIGdldHMgcHJlY2VkZW5jZSBvdmVyIGEgZmllbGRcclxuICAgIGlmICh2YWx1ZUdldHRlcikge1xyXG5cclxuICAgICAgICB2YXIgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICBkYXRhOiBkYXRhLFxyXG4gICAgICAgICAgICBub2RlOiBub2RlLFxyXG4gICAgICAgICAgICBjb2xEZWY6IGNvbERlZixcclxuICAgICAgICAgICAgYXBpOiBhcGksXHJcbiAgICAgICAgICAgIGNvbnRleHQ6IGNvbnRleHRcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlR2V0dGVyID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIC8vIHZhbHVlR2V0dGVyIGlzIGEgZnVuY3Rpb24sIHNvIGp1c3QgY2FsbCBpdFxyXG4gICAgICAgICAgICByZXR1cm4gdmFsdWVHZXR0ZXIocGFyYW1zKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZUdldHRlciA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgLy8gdmFsdWVHZXR0ZXIgaXMgYW4gZXhwcmVzc2lvbiwgc28gZXhlY3V0ZSB0aGUgZXhwcmVzc2lvblxyXG4gICAgICAgICAgICByZXR1cm4gZXhwcmVzc2lvblNlcnZpY2UuZXZhbHVhdGUodmFsdWVHZXR0ZXIsIHBhcmFtcyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgIH0gZWxzZSBpZiAoZmllbGQgJiYgZGF0YSkge1xyXG4gICAgICAgIHJldHVybiBkYXRhW2ZpZWxkXTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH1cclxufTtcclxuXHJcbi8vUmV0dXJucyB0cnVlIGlmIGl0IGlzIGEgRE9NIG5vZGVcclxuLy90YWtlbiBmcm9tOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM4NDI4Ni9qYXZhc2NyaXB0LWlzZG9tLWhvdy1kby15b3UtY2hlY2staWYtYS1qYXZhc2NyaXB0LW9iamVjdC1pcy1hLWRvbS1vYmplY3RcclxuVXRpbHMucHJvdG90eXBlLmlzTm9kZSA9IGZ1bmN0aW9uKG8pIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgICAgdHlwZW9mIE5vZGUgPT09IFwib2JqZWN0XCIgPyBvIGluc3RhbmNlb2YgTm9kZSA6XHJcbiAgICAgICAgbyAmJiB0eXBlb2YgbyA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygby5ub2RlVHlwZSA9PT0gXCJudW1iZXJcIiAmJiB0eXBlb2Ygby5ub2RlTmFtZSA9PT0gXCJzdHJpbmdcIlxyXG4gICAgKTtcclxufTtcclxuXHJcbi8vUmV0dXJucyB0cnVlIGlmIGl0IGlzIGEgRE9NIGVsZW1lbnRcclxuLy90YWtlbiBmcm9tOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM4NDI4Ni9qYXZhc2NyaXB0LWlzZG9tLWhvdy1kby15b3UtY2hlY2staWYtYS1qYXZhc2NyaXB0LW9iamVjdC1pcy1hLWRvbS1vYmplY3RcclxuVXRpbHMucHJvdG90eXBlLmlzRWxlbWVudCA9IGZ1bmN0aW9uKG8pIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgICAgdHlwZW9mIEhUTUxFbGVtZW50ID09PSBcIm9iamVjdFwiID8gbyBpbnN0YW5jZW9mIEhUTUxFbGVtZW50IDogLy9ET00yXHJcbiAgICAgICAgbyAmJiB0eXBlb2YgbyA9PT0gXCJvYmplY3RcIiAmJiBvICE9PSBudWxsICYmIG8ubm9kZVR5cGUgPT09IDEgJiYgdHlwZW9mIG8ubm9kZU5hbWUgPT09IFwic3RyaW5nXCJcclxuICAgICk7XHJcbn07XHJcblxyXG5VdGlscy5wcm90b3R5cGUuaXNOb2RlT3JFbGVtZW50ID0gZnVuY3Rpb24obykge1xyXG4gICAgcmV0dXJuIHRoaXMuaXNOb2RlKG8pIHx8IHRoaXMuaXNFbGVtZW50KG8pO1xyXG59O1xyXG5cclxuLy9hZGRzIGFsbCB0eXBlIG9mIGNoYW5nZSBsaXN0ZW5lcnMgdG8gYW4gZWxlbWVudCwgaW50ZW5kZWQgdG8gYmUgYSB0ZXh0IGZpZWxkXHJcblV0aWxzLnByb3RvdHlwZS5hZGRDaGFuZ2VMaXN0ZW5lciA9IGZ1bmN0aW9uKGVsZW1lbnQsIGxpc3RlbmVyKSB7XHJcbiAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VkXCIsIGxpc3RlbmVyKTtcclxuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcInBhc3RlXCIsIGxpc3RlbmVyKTtcclxuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsIGxpc3RlbmVyKTtcclxufTtcclxuXHJcbi8vaWYgdmFsdWUgaXMgdW5kZWZpbmVkLCBudWxsIG9yIGJsYW5rLCByZXR1cm5zIG51bGwsIG90aGVyd2lzZSByZXR1cm5zIHRoZSB2YWx1ZVxyXG5VdGlscy5wcm90b3R5cGUubWFrZU51bGwgPSBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IFwiXCIpIHtcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgfVxyXG59O1xyXG5cclxuVXRpbHMucHJvdG90eXBlLnJlbW92ZUFsbENoaWxkcmVuID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgaWYgKG5vZGUpIHtcclxuICAgICAgICB3aGlsZSAobm9kZS5oYXNDaGlsZE5vZGVzKCkpIHtcclxuICAgICAgICAgICAgbm9kZS5yZW1vdmVDaGlsZChub2RlLmxhc3RDaGlsZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuLy9hZGRzIGFuIGVsZW1lbnQgdG8gYSBkaXYsIGJ1dCBhbHNvIGFkZHMgYSBiYWNrZ3JvdW5kIGNoZWNraW5nIGZvciBjbGlja3MsXHJcbi8vc28gdGhhdCB3aGVuIHRoZSBiYWNrZ3JvdW5kIGlzIGNsaWNrZWQsIHRoZSBjaGlsZCBpcyByZW1vdmVkIGFnYWluLCBnaXZpbmdcclxuLy9hIG1vZGVsIGxvb2sgdG8gcG9wdXBzLlxyXG5VdGlscy5wcm90b3R5cGUuYWRkQXNNb2RhbFBvcHVwID0gZnVuY3Rpb24oZVBhcmVudCwgZUNoaWxkKSB7XHJcbiAgICB2YXIgcGFyZW50ID0gYW5ndWxhci5lbGVtZW50KGVDaGlsZCk7XHJcblxyXG4gICAgZnVuY3Rpb24gZG9SZW1vdmUoKXtcclxuICAgICAgICBwYXJlbnQucmVtb3ZlKCk7XHJcbiAgICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCByZW1vdmVQb3B1cHMpO1xyXG4gICAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXl1cCcsIG9ua2V5dXApO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciByZW1vdmVQb3B1cHMgPSBmdW5jdGlvbihldnQpIHtcclxuICAgICAgICB2YXIgdGFyZ2V0UGFyZW50ID0gYW5ndWxhci5lbGVtZW50KGV2dC50YXJnZXQpLnBhcmVudHMoJy5hZy1maWx0ZXInKTtcclxuICAgICAgICBpZih0YXJnZXRQYXJlbnRbMF0gIT09IHBhcmVudFswXSl7XHJcbiAgICAgICAgICAgIGRvUmVtb3ZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb25rZXl1cCA9IGZ1bmN0aW9uKGV2dCkge1xyXG4gICAgICAgIGlmKGV2dC5rZXlDb2RlID09PSAyNyl7XHJcbiAgICAgICAgICAgIGRvUmVtb3ZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBlUGFyZW50LmFwcGVuZENoaWxkKGVDaGlsZCk7XHJcblxyXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xyXG4gICAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgcmVtb3ZlUG9wdXBzKTtcclxuICAgICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBvbmtleXVwLCB0cnVlKTtcclxuICAgIH0sIDApO1xyXG59O1xyXG5cclxuLy9sb2FkcyB0aGUgdGVtcGxhdGUgYW5kIHJldHVybnMgaXQgYXMgYW4gZWxlbWVudC4gbWFrZXMgdXAgZm9yIG5vIHNpbXBsZSB3YXkgaW5cclxuLy90aGUgZG9tIGFwaSB0byBsb2FkIGh0bWwgZGlyZWN0bHksIGVnIHdlIGNhbm5vdCBkbyB0aGlzOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRlbXBsYXRlKVxyXG5VdGlscy5wcm90b3R5cGUubG9hZFRlbXBsYXRlID0gZnVuY3Rpb24odGVtcGxhdGUpIHtcclxuICAgIHZhciB0ZW1wRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgIHRlbXBEaXYuaW5uZXJIVE1MID0gdGVtcGxhdGU7XHJcbiAgICByZXR1cm4gdGVtcERpdi5maXJzdENoaWxkO1xyXG59O1xyXG5cclxuLy9pZiBwYXNzZWQgJzQycHgnIHRoZW4gcmV0dXJucyB0aGUgbnVtYmVyIDQyXHJcblV0aWxzLnByb3RvdHlwZS5waXhlbFN0cmluZ1RvTnVtYmVyID0gZnVuY3Rpb24odmFsKSB7XHJcbiAgICBpZiAodHlwZW9mIHZhbCA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgIGlmICh2YWwuaW5kZXhPZihcInB4XCIpID49IDApIHtcclxuICAgICAgICAgICAgdmFsLnJlcGxhY2UoXCJweFwiLCBcIlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KHZhbCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiB2YWw7XHJcbiAgICB9XHJcbn07XHJcblxyXG5VdGlscy5wcm90b3R5cGUucXVlcnlTZWxlY3RvckFsbF9hZGRDc3NDbGFzcyA9IGZ1bmN0aW9uKGVQYXJlbnQsIHNlbGVjdG9yLCBjc3NDbGFzcykge1xyXG4gICAgdmFyIGVSb3dzID0gZVBhcmVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcclxuICAgIGZvciAodmFyIGsgPSAwOyBrIDwgZVJvd3MubGVuZ3RoOyBrKyspIHtcclxuICAgICAgICB0aGlzLmFkZENzc0NsYXNzKGVSb3dzW2tdLCBjc3NDbGFzcyk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5VdGlscy5wcm90b3R5cGUucXVlcnlTZWxlY3RvckFsbF9yZW1vdmVDc3NDbGFzcyA9IGZ1bmN0aW9uKGVQYXJlbnQsIHNlbGVjdG9yLCBjc3NDbGFzcykge1xyXG4gICAgdmFyIGVSb3dzID0gZVBhcmVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcclxuICAgIGZvciAodmFyIGsgPSAwOyBrIDwgZVJvd3MubGVuZ3RoOyBrKyspIHtcclxuICAgICAgICB0aGlzLnJlbW92ZUNzc0NsYXNzKGVSb3dzW2tdLCBjc3NDbGFzcyk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5VdGlscy5wcm90b3R5cGUucXVlcnlTZWxlY3RvckFsbF9yZXBsYWNlQ3NzQ2xhc3MgPSBmdW5jdGlvbihlUGFyZW50LCBzZWxlY3RvciwgY3NzQ2xhc3NUb1JlbW92ZSwgY3NzQ2xhc3NUb0FkZCkge1xyXG4gICAgdmFyIGVSb3dzID0gZVBhcmVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcclxuICAgIGZvciAodmFyIGsgPSAwOyBrIDwgZVJvd3MubGVuZ3RoOyBrKyspIHtcclxuICAgICAgICB0aGlzLnJlbW92ZUNzc0NsYXNzKGVSb3dzW2tdLCBjc3NDbGFzc1RvUmVtb3ZlKTtcclxuICAgICAgICB0aGlzLmFkZENzc0NsYXNzKGVSb3dzW2tdLCBjc3NDbGFzc1RvQWRkKTtcclxuICAgIH1cclxufTtcclxuXHJcblV0aWxzLnByb3RvdHlwZS5hZGRDc3NDbGFzcyA9IGZ1bmN0aW9uKGVsZW1lbnQsIGNsYXNzTmFtZSkge1xyXG4gICAgdmFyIG9sZENsYXNzZXMgPSBlbGVtZW50LmNsYXNzTmFtZTtcclxuICAgIGlmIChvbGRDbGFzc2VzKSB7XHJcbiAgICAgICAgaWYgKG9sZENsYXNzZXMuaW5kZXhPZihjbGFzc05hbWUpID49IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbGVtZW50LmNsYXNzTmFtZSA9IG9sZENsYXNzZXMgKyBcIiBcIiArIGNsYXNzTmFtZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZWxlbWVudC5jbGFzc05hbWUgPSBjbGFzc05hbWU7XHJcbiAgICB9XHJcbn07XHJcblxyXG5VdGlscy5wcm90b3R5cGUucmVtb3ZlQ3NzQ2xhc3MgPSBmdW5jdGlvbihlbGVtZW50LCBjbGFzc05hbWUpIHtcclxuICAgIHZhciBvbGRDbGFzc2VzID0gZWxlbWVudC5jbGFzc05hbWU7XHJcbiAgICBpZiAob2xkQ2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSkgPCAwKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdmFyIG5ld0NsYXNzZXMgPSBvbGRDbGFzc2VzLnJlcGxhY2UoXCIgXCIgKyBjbGFzc05hbWUsIFwiXCIpO1xyXG4gICAgbmV3Q2xhc3NlcyA9IG5ld0NsYXNzZXMucmVwbGFjZShjbGFzc05hbWUgKyBcIiBcIiwgXCJcIik7XHJcbiAgICBpZiAobmV3Q2xhc3NlcyA9PSBjbGFzc05hbWUpIHtcclxuICAgICAgICBuZXdDbGFzc2VzID0gXCJcIjtcclxuICAgIH1cclxuICAgIGVsZW1lbnQuY2xhc3NOYW1lID0gbmV3Q2xhc3NlcztcclxufTtcclxuXHJcblV0aWxzLnByb3RvdHlwZS5yZW1vdmVGcm9tQXJyYXkgPSBmdW5jdGlvbihhcnJheSwgb2JqZWN0KSB7XHJcbiAgICBhcnJheS5zcGxpY2UoYXJyYXkuaW5kZXhPZihvYmplY3QpLCAxKTtcclxufTtcclxuXHJcblV0aWxzLnByb3RvdHlwZS5kZWZhdWx0Q29tcGFyYXRvciA9IGZ1bmN0aW9uKHZhbHVlQSwgdmFsdWVCKSB7XHJcbiAgICB2YXIgdmFsdWVBTWlzc2luZyA9IHZhbHVlQSA9PT0gbnVsbCB8fCB2YWx1ZUEgPT09IHVuZGVmaW5lZDtcclxuICAgIHZhciB2YWx1ZUJNaXNzaW5nID0gdmFsdWVCID09PSBudWxsIHx8IHZhbHVlQiA9PT0gdW5kZWZpbmVkO1xyXG4gICAgaWYgKHZhbHVlQU1pc3NpbmcgJiYgdmFsdWVCTWlzc2luZykge1xyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgfVxyXG4gICAgaWYgKHZhbHVlQU1pc3NpbmcpIHtcclxuICAgICAgICByZXR1cm4gLTE7XHJcbiAgICB9XHJcbiAgICBpZiAodmFsdWVCTWlzc2luZykge1xyXG4gICAgICAgIHJldHVybiAxO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh2YWx1ZUEgPCB2YWx1ZUIpIHtcclxuICAgICAgICByZXR1cm4gLTE7XHJcbiAgICB9IGVsc2UgaWYgKHZhbHVlQSA+IHZhbHVlQikge1xyXG4gICAgICAgIHJldHVybiAxO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gMDtcclxuICAgIH1cclxufTtcclxuXHJcblV0aWxzLnByb3RvdHlwZS5mb3JtYXRXaWR0aCA9IGZ1bmN0aW9uKHdpZHRoKSB7XHJcbiAgICBpZiAodHlwZW9mIHdpZHRoID09PSBcIm51bWJlclwiKSB7XHJcbiAgICAgICAgcmV0dXJuIHdpZHRoICsgXCJweFwiO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gd2lkdGg7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vLyB0cmllcyB0byB1c2UgdGhlIHByb3ZpZGVkIHJlbmRlcmVyLiBpZiBhIHJlbmRlcmVyIGZvdW5kLCByZXR1cm5zIHRydWUuXHJcbi8vIGlmIG5vIHJlbmRlcmVyLCByZXR1cm5zIGZhbHNlLlxyXG5VdGlscy5wcm90b3R5cGUudXNlUmVuZGVyZXIgPSBmdW5jdGlvbihlUGFyZW50LCBlUmVuZGVyZXIsIHBhcmFtcykge1xyXG4gICAgdmFyIHJlc3VsdEZyb21SZW5kZXJlciA9IGVSZW5kZXJlcihwYXJhbXMpO1xyXG4gICAgaWYgKHRoaXMuaXNOb2RlKHJlc3VsdEZyb21SZW5kZXJlcikgfHwgdGhpcy5pc0VsZW1lbnQocmVzdWx0RnJvbVJlbmRlcmVyKSkge1xyXG4gICAgICAgIC8vYSBkb20gbm9kZSBvciBlbGVtZW50IHdhcyByZXR1cm5lZCwgc28gYWRkIGNoaWxkXHJcbiAgICAgICAgZVBhcmVudC5hcHBlbmRDaGlsZChyZXN1bHRGcm9tUmVuZGVyZXIpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICAvL290aGVyd2lzZSBhc3N1bWUgaXQgd2FzIGh0bWwsIHNvIGp1c3QgaW5zZXJ0XHJcbiAgICAgICAgdmFyIGVUZXh0U3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgICAgICBlVGV4dFNwYW4uaW5uZXJIVE1MID0gcmVzdWx0RnJvbVJlbmRlcmVyO1xyXG4gICAgICAgIGVQYXJlbnQuYXBwZW5kQ2hpbGQoZVRleHRTcGFuKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8vIGlmIGljb24gcHJvdmlkZWQsIHVzZSB0aGlzIChlaXRoZXIgYSBzdHJpbmcsIG9yIGEgZnVuY3Rpb24gY2FsbGJhY2spLlxyXG4vLyBpZiBub3QsIHRoZW4gdXNlIHRoZSBzZWNvbmQgcGFyYW1ldGVyLCB3aGljaCBpcyB0aGUgc3ZnRmFjdG9yeSBmdW5jdGlvblxyXG5VdGlscy5wcm90b3R5cGUuY3JlYXRlSWNvbiA9IGZ1bmN0aW9uKGljb25OYW1lLCBncmlkT3B0aW9uc1dyYXBwZXIsIGNvbERlZldyYXBwZXIsIHN2Z0ZhY3RvcnlGdW5jKSB7XHJcbiAgICB2YXIgZVJlc3VsdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgIHZhciB1c2VyUHJvdmlkZWRJY29uO1xyXG4gICAgLy8gY2hlY2sgY29sIGZvciBpY29uIGZpcnN0XHJcbiAgICBpZiAoY29sRGVmV3JhcHBlciAmJiBjb2xEZWZXcmFwcGVyLmNvbERlZi5pY29ucykge1xyXG4gICAgICAgIHVzZXJQcm92aWRlZEljb24gPSBjb2xEZWZXcmFwcGVyLmNvbERlZi5pY29uc1tpY29uTmFtZV07XHJcbiAgICB9XHJcbiAgICAvLyBpdCBub3QgaW4gY29sLCB0cnkgZ3JpZCBvcHRpb25zXHJcbiAgICBpZiAoIXVzZXJQcm92aWRlZEljb24gJiYgZ3JpZE9wdGlvbnNXcmFwcGVyLmdldEljb25zKCkpIHtcclxuICAgICAgICB1c2VyUHJvdmlkZWRJY29uID0gZ3JpZE9wdGlvbnNXcmFwcGVyLmdldEljb25zKClbaWNvbk5hbWVdO1xyXG4gICAgfVxyXG4gICAgLy8gbm93IGlmIHVzZXIgcHJvdmlkZWQsIHVzZSBpdFxyXG4gICAgaWYgKHVzZXJQcm92aWRlZEljb24pIHtcclxuICAgICAgICB2YXIgcmVuZGVyZXJSZXN1bHQ7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB1c2VyUHJvdmlkZWRJY29uID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyUmVzdWx0ID0gdXNlclByb3ZpZGVkSWNvbigpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHVzZXJQcm92aWRlZEljb24gPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIHJlbmRlcmVyUmVzdWx0ID0gdXNlclByb3ZpZGVkSWNvbjtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aHJvdyAnaWNvbiBmcm9tIGdyaWQgb3B0aW9ucyBuZWVkcyB0byBiZSBhIHN0cmluZyBvciBhIGZ1bmN0aW9uJztcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiByZW5kZXJlclJlc3VsdCA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgZVJlc3VsdC5pbm5lckhUTUwgPSByZW5kZXJlclJlc3VsdDtcclxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuaXNOb2RlT3JFbGVtZW50KHJlbmRlcmVyUmVzdWx0KSkge1xyXG4gICAgICAgICAgICBlUmVzdWx0LmFwcGVuZENoaWxkKHJlbmRlcmVyUmVzdWx0KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aHJvdyAnaWNvblJlbmRlcmVyIHNob3VsZCByZXR1cm4gYmFjayBhIHN0cmluZyBvciBhIGRvbSBvYmplY3QnO1xyXG4gICAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gb3RoZXJ3aXNlIHdlIHVzZSB0aGUgYnVpbHQgaW4gaWNvblxyXG4gICAgICAgIGVSZXN1bHQuYXBwZW5kQ2hpbGQoc3ZnRmFjdG9yeUZ1bmMoKSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZVJlc3VsdDtcclxufTtcclxuXHJcblxyXG5VdGlscy5wcm90b3R5cGUuZ2V0U2Nyb2xsYmFyV2lkdGggPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgb3V0ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgb3V0ZXIuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7XHJcbiAgICBvdXRlci5zdHlsZS53aWR0aCA9IFwiMTAwcHhcIjtcclxuICAgIG91dGVyLnN0eWxlLm1zT3ZlcmZsb3dTdHlsZSA9IFwic2Nyb2xsYmFyXCI7IC8vIG5lZWRlZCBmb3IgV2luSlMgYXBwc1xyXG5cclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3V0ZXIpO1xyXG5cclxuICAgIHZhciB3aWR0aE5vU2Nyb2xsID0gb3V0ZXIub2Zmc2V0V2lkdGg7XHJcbiAgICAvLyBmb3JjZSBzY3JvbGxiYXJzXHJcbiAgICBvdXRlci5zdHlsZS5vdmVyZmxvdyA9IFwic2Nyb2xsXCI7XHJcblxyXG4gICAgLy8gYWRkIGlubmVyZGl2XHJcbiAgICB2YXIgaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgaW5uZXIuc3R5bGUud2lkdGggPSBcIjEwMCVcIjtcclxuICAgIG91dGVyLmFwcGVuZENoaWxkKGlubmVyKTtcclxuXHJcbiAgICB2YXIgd2lkdGhXaXRoU2Nyb2xsID0gaW5uZXIub2Zmc2V0V2lkdGg7XHJcblxyXG4gICAgLy8gcmVtb3ZlIGRpdnNcclxuICAgIG91dGVyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQob3V0ZXIpO1xyXG5cclxuICAgIHJldHVybiB3aWR0aE5vU2Nyb2xsIC0gd2lkdGhXaXRoU2Nyb2xsO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBuZXcgVXRpbHMoKTtcclxuIiwiLypcclxuICogVGhpcyByb3cgY29udHJvbGxlciBpcyB1c2VkIGZvciBpbmZpbml0ZSBzY3JvbGxpbmcgb25seS4gRm9yIG5vcm1hbCAnaW4gbWVtb3J5JyB0YWJsZSxcclxuICogb3Igc3RhbmRhcmQgcGFnaW5hdGlvbiwgdGhlIGluTWVtb3J5Um93Q29udHJvbGxlciBpcyB1c2VkLlxyXG4gKi9cclxuXHJcbnZhciBsb2dnaW5nID0gdHJ1ZTtcclxuXHJcbmZ1bmN0aW9uIFZpcnR1YWxQYWdlUm93Q29udHJvbGxlcigpIHt9XHJcblxyXG5WaXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbihyb3dSZW5kZXJlcikge1xyXG4gICAgdGhpcy5yb3dSZW5kZXJlciA9IHJvd1JlbmRlcmVyO1xyXG4gICAgdGhpcy5kYXRhc291cmNlVmVyc2lvbiA9IDA7XHJcbn07XHJcblxyXG5WaXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLnNldERhdGFzb3VyY2UgPSBmdW5jdGlvbihkYXRhc291cmNlKSB7XHJcbiAgICB0aGlzLmRhdGFzb3VyY2UgPSBkYXRhc291cmNlO1xyXG5cclxuICAgIGlmICghZGF0YXNvdXJjZSkge1xyXG4gICAgICAgIC8vIG9ubHkgY29udGludWUgaWYgd2UgaGF2ZSBhIHZhbGlkIGRhdGFzb3VyY2UgdG8gd29ya2luZyB3aXRoXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucmVzZXQoKTtcclxufTtcclxuXHJcblZpcnR1YWxQYWdlUm93Q29udHJvbGxlci5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpIHtcclxuICAgIC8vIHNlZSBpZiBkYXRhc291cmNlIGtub3dzIGhvdyBtYW55IHJvd3MgdGhlcmUgYXJlXHJcbiAgICBpZiAodHlwZW9mIHRoaXMuZGF0YXNvdXJjZS5yb3dDb3VudCA9PT0gJ251bWJlcicgJiYgdGhpcy5kYXRhc291cmNlLnJvd0NvdW50ID49IDApIHtcclxuICAgICAgICB0aGlzLnZpcnR1YWxSb3dDb3VudCA9IHRoaXMuZGF0YXNvdXJjZS5yb3dDb3VudDtcclxuICAgICAgICB0aGlzLmZvdW5kTWF4Um93ID0gdHJ1ZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy52aXJ0dWFsUm93Q291bnQgPSAwO1xyXG4gICAgICAgIHRoaXMuZm91bmRNYXhSb3cgPSBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBpbiBjYXNlIGFueSBkYWVtb24gcmVxdWVzdHMgY29taW5nIGZyb20gZGF0YXNvdXJjZSwgd2Uga25vdyBpdCBpZ25vcmUgdGhlbVxyXG4gICAgdGhpcy5kYXRhc291cmNlVmVyc2lvbisrO1xyXG5cclxuICAgIC8vIG1hcCBvZiBwYWdlIG51bWJlcnMgdG8gcm93cyBpbiB0aGF0IHBhZ2VcclxuICAgIHRoaXMucGFnZUNhY2hlID0ge307XHJcbiAgICB0aGlzLnBhZ2VDYWNoZVNpemUgPSAwO1xyXG5cclxuICAgIC8vIGlmIGEgbnVtYmVyIGlzIGluIHRoaXMgYXJyYXksIGl0IG1lYW5zIHdlIGFyZSBwZW5kaW5nIGEgbG9hZCBmcm9tIGl0XHJcbiAgICB0aGlzLnBhZ2VMb2Fkc0luUHJvZ3Jlc3MgPSBbXTtcclxuICAgIHRoaXMucGFnZUxvYWRzUXVldWVkID0gW107XHJcbiAgICB0aGlzLnBhZ2VBY2Nlc3NUaW1lcyA9IHt9OyAvLyBrZWVwcyBhIHJlY29yZCBvZiB3aGVuIGVhY2ggcGFnZSB3YXMgbGFzdCB2aWV3ZWQsIHVzZWQgZm9yIExSVSBjYWNoZVxyXG4gICAgdGhpcy5hY2Nlc3NUaW1lID0gMDsgLy8gcmF0aGVyIHRoYW4gdXNpbmcgdGhlIGNsb2NrLCB3ZSB1c2UgdGhpcyBjb3VudGVyXHJcblxyXG4gICAgLy8gdGhlIG51bWJlciBvZiBjb25jdXJyZW50IGxvYWRzIHdlIGFyZSBhbGxvd2VkIHRvIHRoZSBzZXJ2ZXJcclxuICAgIGlmICh0eXBlb2YgdGhpcy5kYXRhc291cmNlLm1heENvbmN1cnJlbnRSZXF1ZXN0cyA9PT0gJ251bWJlcicgJiYgdGhpcy5kYXRhc291cmNlLm1heENvbmN1cnJlbnRSZXF1ZXN0cyA+IDApIHtcclxuICAgICAgICB0aGlzLm1heENvbmN1cnJlbnREYXRhc291cmNlUmVxdWVzdHMgPSB0aGlzLmRhdGFzb3VyY2UubWF4Q29uY3VycmVudFJlcXVlc3RzO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLm1heENvbmN1cnJlbnREYXRhc291cmNlUmVxdWVzdHMgPSAyO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIHRoZSBudW1iZXIgb2YgcGFnZXMgdG8ga2VlcCBpbiBicm93c2VyIGNhY2hlXHJcbiAgICBpZiAodHlwZW9mIHRoaXMuZGF0YXNvdXJjZS5tYXhQYWdlc0luQ2FjaGUgPT09ICdudW1iZXInICYmIHRoaXMuZGF0YXNvdXJjZS5tYXhQYWdlc0luQ2FjaGUgPiAwKSB7XHJcbiAgICAgICAgdGhpcy5tYXhQYWdlc0luQ2FjaGUgPSB0aGlzLmRhdGFzb3VyY2UubWF4UGFnZXNJbkNhY2hlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBudWxsIGlzIGRlZmF1bHQsIG1lYW5zIGRvbid0ICBoYXZlIGFueSBtYXggc2l6ZSBvbiB0aGUgY2FjaGVcclxuICAgICAgICB0aGlzLm1heFBhZ2VzSW5DYWNoZSA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5wYWdlU2l6ZSA9IHRoaXMuZGF0YXNvdXJjZS5wYWdlU2l6ZTsgLy8gdGFrZSBhIGNvcHkgb2YgcGFnZSBzaXplLCB3ZSBkb24ndCB3YW50IGl0IGNoYW5naW5nXHJcbiAgICB0aGlzLm92ZXJmbG93U2l6ZSA9IHRoaXMuZGF0YXNvdXJjZS5vdmVyZmxvd1NpemU7IC8vIHRha2UgYSBjb3B5IG9mIHBhZ2Ugc2l6ZSwgd2UgZG9uJ3Qgd2FudCBpdCBjaGFuZ2luZ1xyXG5cclxuICAgIHRoaXMuZG9Mb2FkT3JRdWV1ZSgwKTtcclxufTtcclxuXHJcblZpcnR1YWxQYWdlUm93Q29udHJvbGxlci5wcm90b3R5cGUuY3JlYXRlTm9kZXNGcm9tUm93cyA9IGZ1bmN0aW9uKHBhZ2VOdW1iZXIsIHJvd3MpIHtcclxuICAgIHZhciBub2RlcyA9IFtdO1xyXG4gICAgaWYgKHJvd3MpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgaiA9IHJvd3MubGVuZ3RoOyBpIDwgajsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciB2aXJ0dWFsUm93SW5kZXggPSAocGFnZU51bWJlciAqIHRoaXMucGFnZVNpemUpICsgaTtcclxuICAgICAgICAgICAgbm9kZXMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICBkYXRhOiByb3dzW2ldLFxyXG4gICAgICAgICAgICAgICAgaWQ6IHZpcnR1YWxSb3dJbmRleFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbm9kZXM7XHJcbn07XHJcblxyXG5WaXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLnJlbW92ZUZyb21Mb2FkaW5nID0gZnVuY3Rpb24ocGFnZU51bWJlcikge1xyXG4gICAgdmFyIGluZGV4ID0gdGhpcy5wYWdlTG9hZHNJblByb2dyZXNzLmluZGV4T2YocGFnZU51bWJlcik7XHJcbiAgICB0aGlzLnBhZ2VMb2Fkc0luUHJvZ3Jlc3Muc3BsaWNlKGluZGV4LCAxKTtcclxufTtcclxuXHJcblZpcnR1YWxQYWdlUm93Q29udHJvbGxlci5wcm90b3R5cGUucGFnZUxvYWRGYWlsZWQgPSBmdW5jdGlvbihwYWdlTnVtYmVyKSB7XHJcbiAgICB0aGlzLnJlbW92ZUZyb21Mb2FkaW5nKHBhZ2VOdW1iZXIpO1xyXG4gICAgdGhpcy5jaGVja1F1ZXVlRm9yTmV4dExvYWQoKTtcclxufTtcclxuXHJcblZpcnR1YWxQYWdlUm93Q29udHJvbGxlci5wcm90b3R5cGUucGFnZUxvYWRlZCA9IGZ1bmN0aW9uKHBhZ2VOdW1iZXIsIHJvd3MsIGxhc3RSb3cpIHtcclxuICAgIHRoaXMucHV0UGFnZUludG9DYWNoZUFuZFB1cmdlKHBhZ2VOdW1iZXIsIHJvd3MpO1xyXG4gICAgdGhpcy5jaGVja01heFJvd0FuZEluZm9ybVJvd1JlbmRlcmVyKHBhZ2VOdW1iZXIsIGxhc3RSb3cpO1xyXG4gICAgdGhpcy5yZW1vdmVGcm9tTG9hZGluZyhwYWdlTnVtYmVyKTtcclxuICAgIHRoaXMuY2hlY2tRdWV1ZUZvck5leHRMb2FkKCk7XHJcbn07XHJcblxyXG5WaXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLnB1dFBhZ2VJbnRvQ2FjaGVBbmRQdXJnZSA9IGZ1bmN0aW9uKHBhZ2VOdW1iZXIsIHJvd3MpIHtcclxuICAgIHRoaXMucGFnZUNhY2hlW3BhZ2VOdW1iZXJdID0gdGhpcy5jcmVhdGVOb2Rlc0Zyb21Sb3dzKHBhZ2VOdW1iZXIsIHJvd3MpO1xyXG4gICAgdGhpcy5wYWdlQ2FjaGVTaXplKys7XHJcbiAgICBpZiAobG9nZ2luZykge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdhZGRpbmcgcGFnZSAnICsgcGFnZU51bWJlcik7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIG5lZWRUb1B1cmdlID0gdGhpcy5tYXhQYWdlc0luQ2FjaGUgJiYgdGhpcy5tYXhQYWdlc0luQ2FjaGUgPCB0aGlzLnBhZ2VDYWNoZVNpemU7XHJcbiAgICBpZiAobmVlZFRvUHVyZ2UpIHtcclxuICAgICAgICAvLyBmaW5kIHRoZSBMUlUgcGFnZVxyXG4gICAgICAgIHZhciB5b3VuZ2VzdFBhZ2VJbmRleCA9IHRoaXMuZmluZExlYXN0UmVjZW50bHlBY2Nlc3NlZFBhZ2UoT2JqZWN0LmtleXModGhpcy5wYWdlQ2FjaGUpKTtcclxuXHJcbiAgICAgICAgaWYgKGxvZ2dpbmcpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ3B1cmdpbmcgcGFnZSAnICsgeW91bmdlc3RQYWdlSW5kZXggKyAnIGZyb20gY2FjaGUgJyArIE9iamVjdC5rZXlzKHRoaXMucGFnZUNhY2hlKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGRlbGV0ZSB0aGlzLnBhZ2VDYWNoZVt5b3VuZ2VzdFBhZ2VJbmRleF07XHJcbiAgICAgICAgdGhpcy5wYWdlQ2FjaGVTaXplLS07XHJcbiAgICB9XHJcblxyXG59O1xyXG5cclxuVmlydHVhbFBhZ2VSb3dDb250cm9sbGVyLnByb3RvdHlwZS5jaGVja01heFJvd0FuZEluZm9ybVJvd1JlbmRlcmVyID0gZnVuY3Rpb24ocGFnZU51bWJlciwgbGFzdFJvdykge1xyXG4gICAgaWYgKCF0aGlzLmZvdW5kTWF4Um93KSB7XHJcbiAgICAgICAgLy8gaWYgd2Uga25vdyB0aGUgbGFzdCByb3csIHVzZSBpZlxyXG4gICAgICAgIGlmICh0eXBlb2YgbGFzdFJvdyA9PT0gJ251bWJlcicgJiYgbGFzdFJvdyA+PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMudmlydHVhbFJvd0NvdW50ID0gbGFzdFJvdztcclxuICAgICAgICAgICAgdGhpcy5mb3VuZE1heFJvdyA9IHRydWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBzZWUgaWYgd2UgbmVlZCB0byBhZGQgc29tZSB2aXJ0dWFsIHJvd3NcclxuICAgICAgICAgICAgdmFyIHRoaXNQYWdlUGx1c0J1ZmZlciA9ICgocGFnZU51bWJlciArIDEpICogdGhpcy5wYWdlU2l6ZSkgKyB0aGlzLm92ZXJmbG93U2l6ZTtcclxuICAgICAgICAgICAgaWYgKHRoaXMudmlydHVhbFJvd0NvdW50IDwgdGhpc1BhZ2VQbHVzQnVmZmVyKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZpcnR1YWxSb3dDb3VudCA9IHRoaXNQYWdlUGx1c0J1ZmZlcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBpZiByb3dDb3VudCBjaGFuZ2VzLCByZWZyZXNoVmlldywgb3RoZXJ3aXNlIGp1c3QgcmVmcmVzaEFsbFZpcnR1YWxSb3dzXHJcbiAgICAgICAgdGhpcy5yb3dSZW5kZXJlci5yZWZyZXNoVmlldygpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLnJvd1JlbmRlcmVyLnJlZnJlc2hBbGxWaXJ0dWFsUm93cygpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuVmlydHVhbFBhZ2VSb3dDb250cm9sbGVyLnByb3RvdHlwZS5pc1BhZ2VBbHJlYWR5TG9hZGluZyA9IGZ1bmN0aW9uKHBhZ2VOdW1iZXIpIHtcclxuICAgIHZhciByZXN1bHQgPSB0aGlzLnBhZ2VMb2Fkc0luUHJvZ3Jlc3MuaW5kZXhPZihwYWdlTnVtYmVyKSA+PSAwIHx8IHRoaXMucGFnZUxvYWRzUXVldWVkLmluZGV4T2YocGFnZU51bWJlcikgPj0gMDtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn07XHJcblxyXG5WaXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmRvTG9hZE9yUXVldWUgPSBmdW5jdGlvbihwYWdlTnVtYmVyKSB7XHJcbiAgICAvLyBpZiB3ZSBhbHJlYWR5IHRyaWVkIHRvIGxvYWQgdGhpcyBwYWdlLCB0aGVuIGlnbm9yZSB0aGUgcmVxdWVzdCxcclxuICAgIC8vIG90aGVyd2lzZSBzZXJ2ZXIgd291bGQgYmUgaGl0IDUwIHRpbWVzIGp1c3QgdG8gZGlzcGxheSBvbmUgcGFnZSwgdGhlXHJcbiAgICAvLyBmaXJzdCByb3cgdG8gZmluZCB0aGUgcGFnZSBtaXNzaW5nIGlzIGVub3VnaC5cclxuICAgIGlmICh0aGlzLmlzUGFnZUFscmVhZHlMb2FkaW5nKHBhZ2VOdW1iZXIpKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIHRyeSB0aGUgcGFnZSBsb2FkIC0gaWYgbm90IGFscmVhZHkgZG9pbmcgYSBsb2FkLCB0aGVuIHdlIGNhbiBnbyBhaGVhZFxyXG4gICAgaWYgKHRoaXMucGFnZUxvYWRzSW5Qcm9ncmVzcy5sZW5ndGggPCB0aGlzLm1heENvbmN1cnJlbnREYXRhc291cmNlUmVxdWVzdHMpIHtcclxuICAgICAgICAvLyBnbyBhaGVhZCwgbG9hZCB0aGUgcGFnZVxyXG4gICAgICAgIHRoaXMubG9hZFBhZ2UocGFnZU51bWJlcik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIG90aGVyd2lzZSwgcXVldWUgdGhlIHJlcXVlc3RcclxuICAgICAgICB0aGlzLmFkZFRvUXVldWVBbmRQdXJnZVF1ZXVlKHBhZ2VOdW1iZXIpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuVmlydHVhbFBhZ2VSb3dDb250cm9sbGVyLnByb3RvdHlwZS5hZGRUb1F1ZXVlQW5kUHVyZ2VRdWV1ZSA9IGZ1bmN0aW9uKHBhZ2VOdW1iZXIpIHtcclxuICAgIGlmIChsb2dnaW5nKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ3F1ZXVlaW5nICcgKyBwYWdlTnVtYmVyICsgJyAtICcgKyB0aGlzLnBhZ2VMb2Fkc1F1ZXVlZCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBhZ2VMb2Fkc1F1ZXVlZC5wdXNoKHBhZ2VOdW1iZXIpO1xyXG5cclxuICAgIC8vIHNlZSBpZiB0aGVyZSBhcmUgbW9yZSBwYWdlcyBxdWV1ZWQgdGhhdCBhcmUgYWN0dWFsbHkgaW4gb3VyIGNhY2hlLCBpZiBzbyB0aGVyZSBpc1xyXG4gICAgLy8gbm8gcG9pbnQgaW4gbG9hZGluZyB0aGVtIGFsbCBhcyBzb21lIHdpbGwgYmUgcHVyZ2VkIGFzIHNvb24gYXMgbG9hZGVkXHJcbiAgICB2YXIgbmVlZFRvUHVyZ2UgPSB0aGlzLm1heFBhZ2VzSW5DYWNoZSAmJiB0aGlzLm1heFBhZ2VzSW5DYWNoZSA8IHRoaXMucGFnZUxvYWRzUXVldWVkLmxlbmd0aDtcclxuICAgIGlmIChuZWVkVG9QdXJnZSkge1xyXG4gICAgICAgIC8vIGZpbmQgdGhlIExSVSBwYWdlXHJcbiAgICAgICAgdmFyIHlvdW5nZXN0UGFnZUluZGV4ID0gdGhpcy5maW5kTGVhc3RSZWNlbnRseUFjY2Vzc2VkUGFnZSh0aGlzLnBhZ2VMb2Fkc1F1ZXVlZCk7XHJcblxyXG4gICAgICAgIGlmIChsb2dnaW5nKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdkZS1xdWV1ZWluZyAnICsgcGFnZU51bWJlciArICcgLSAnICsgdGhpcy5wYWdlTG9hZHNRdWV1ZWQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGluZGV4VG9SZW1vdmUgPSB0aGlzLnBhZ2VMb2Fkc1F1ZXVlZC5pbmRleE9mKHlvdW5nZXN0UGFnZUluZGV4KTtcclxuICAgICAgICB0aGlzLnBhZ2VMb2Fkc1F1ZXVlZC5zcGxpY2UoaW5kZXhUb1JlbW92ZSwgMSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5WaXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmZpbmRMZWFzdFJlY2VudGx5QWNjZXNzZWRQYWdlID0gZnVuY3Rpb24ocGFnZUluZGV4ZXMpIHtcclxuICAgIHZhciB5b3VuZ2VzdFBhZ2VJbmRleCA9IC0xO1xyXG4gICAgdmFyIHlvdW5nZXN0UGFnZUFjY2Vzc1RpbWUgPSBOdW1iZXIuTUFYX1ZBTFVFO1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG5cclxuICAgIHBhZ2VJbmRleGVzLmZvckVhY2goZnVuY3Rpb24ocGFnZUluZGV4KSB7XHJcbiAgICAgICAgdmFyIGFjY2Vzc1RpbWVUaGlzUGFnZSA9IHRoYXQucGFnZUFjY2Vzc1RpbWVzW3BhZ2VJbmRleF07XHJcbiAgICAgICAgaWYgKGFjY2Vzc1RpbWVUaGlzUGFnZSA8IHlvdW5nZXN0UGFnZUFjY2Vzc1RpbWUpIHtcclxuICAgICAgICAgICAgeW91bmdlc3RQYWdlQWNjZXNzVGltZSA9IGFjY2Vzc1RpbWVUaGlzUGFnZTtcclxuICAgICAgICAgICAgeW91bmdlc3RQYWdlSW5kZXggPSBwYWdlSW5kZXg7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHlvdW5nZXN0UGFnZUluZGV4O1xyXG59O1xyXG5cclxuVmlydHVhbFBhZ2VSb3dDb250cm9sbGVyLnByb3RvdHlwZS5jaGVja1F1ZXVlRm9yTmV4dExvYWQgPSBmdW5jdGlvbigpIHtcclxuICAgIGlmICh0aGlzLnBhZ2VMb2Fkc1F1ZXVlZC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgLy8gdGFrZSBmcm9tIHRoZSBmcm9udCBvZiB0aGUgcXVldWVcclxuICAgICAgICB2YXIgcGFnZVRvTG9hZCA9IHRoaXMucGFnZUxvYWRzUXVldWVkWzBdO1xyXG4gICAgICAgIHRoaXMucGFnZUxvYWRzUXVldWVkLnNwbGljZSgwLCAxKTtcclxuXHJcbiAgICAgICAgaWYgKGxvZ2dpbmcpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ2RlcXVldWVpbmcgJyArIHBhZ2VUb0xvYWQgKyAnIC0gJyArIHRoaXMucGFnZUxvYWRzUXVldWVkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMubG9hZFBhZ2UocGFnZVRvTG9hZCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5WaXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmxvYWRQYWdlID0gZnVuY3Rpb24ocGFnZU51bWJlcikge1xyXG5cclxuICAgIHRoaXMucGFnZUxvYWRzSW5Qcm9ncmVzcy5wdXNoKHBhZ2VOdW1iZXIpO1xyXG5cclxuICAgIHZhciBzdGFydFJvdyA9IHBhZ2VOdW1iZXIgKiB0aGlzLnBhZ2VTaXplO1xyXG4gICAgdmFyIGVuZFJvdyA9IChwYWdlTnVtYmVyICsgMSkgKiB0aGlzLnBhZ2VTaXplO1xyXG5cclxuICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgIHZhciBkYXRhc291cmNlVmVyc2lvbkNvcHkgPSB0aGlzLmRhdGFzb3VyY2VWZXJzaW9uO1xyXG5cclxuICAgIHRoaXMuZGF0YXNvdXJjZS5nZXRSb3dzKHN0YXJ0Um93LCBlbmRSb3csXHJcbiAgICAgICAgZnVuY3Rpb24gc3VjY2Vzcyhyb3dzLCBsYXN0Um93KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGF0LnJlcXVlc3RJc0RhZW1vbihkYXRhc291cmNlVmVyc2lvbkNvcHkpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhhdC5wYWdlTG9hZGVkKHBhZ2VOdW1iZXIsIHJvd3MsIGxhc3RSb3cpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZnVuY3Rpb24gZmFpbCgpIHtcclxuICAgICAgICAgICAgaWYgKHRoYXQucmVxdWVzdElzRGFlbW9uKGRhdGFzb3VyY2VWZXJzaW9uQ29weSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGF0LnBhZ2VMb2FkRmFpbGVkKHBhZ2VOdW1iZXIpO1xyXG4gICAgICAgIH1cclxuICAgICk7XHJcbn07XHJcblxyXG4vLyBjaGVjayB0aGF0IHRoZSBkYXRhc291cmNlIGhhcyBub3QgY2hhbmdlZCBzaW5jZSB0aGUgbGF0cyB0aW1lIHdlIGRpZCBhIHJlcXVlc3RcclxuVmlydHVhbFBhZ2VSb3dDb250cm9sbGVyLnByb3RvdHlwZS5yZXF1ZXN0SXNEYWVtb24gPSBmdW5jdGlvbihkYXRhc291cmNlVmVyc2lvbkNvcHkpIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGFzb3VyY2VWZXJzaW9uICE9PSBkYXRhc291cmNlVmVyc2lvbkNvcHk7XHJcbn07XHJcblxyXG5WaXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXIucHJvdG90eXBlLmdldFZpcnR1YWxSb3cgPSBmdW5jdGlvbihyb3dJbmRleCkge1xyXG4gICAgaWYgKHJvd0luZGV4ID4gdGhpcy52aXJ0dWFsUm93Q291bnQpIHtcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcGFnZU51bWJlciA9IE1hdGguZmxvb3Iocm93SW5kZXggLyB0aGlzLnBhZ2VTaXplKTtcclxuICAgIHZhciBwYWdlID0gdGhpcy5wYWdlQ2FjaGVbcGFnZU51bWJlcl07XHJcblxyXG4gICAgLy8gZm9yIExSVSBjYWNoZSwgdHJhY2sgd2hlbiB0aGlzIHBhZ2Ugd2FzIGxhc3QgaGl0XHJcbiAgICB0aGlzLnBhZ2VBY2Nlc3NUaW1lc1twYWdlTnVtYmVyXSA9IHRoaXMuYWNjZXNzVGltZSsrO1xyXG5cclxuICAgIGlmICghcGFnZSkge1xyXG4gICAgICAgIHRoaXMuZG9Mb2FkT3JRdWV1ZShwYWdlTnVtYmVyKTtcclxuICAgICAgICAvLyByZXR1cm4gYmFjayBhbiBlbXB0eSByb3csIHNvIHRhYmxlIGNhbiBhdCBsZWFzdCByZW5kZXIgZW1wdHkgY2VsbHNcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBkYXRhOiB7fSxcclxuICAgICAgICAgICAgaWQ6IHJvd0luZGV4XHJcbiAgICAgICAgfTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdmFyIGluZGV4SW5UaGlzUGFnZSA9IHJvd0luZGV4ICUgdGhpcy5wYWdlU2l6ZTtcclxuICAgICAgICByZXR1cm4gcGFnZVtpbmRleEluVGhpc1BhZ2VdO1xyXG4gICAgfVxyXG59O1xyXG5cclxuVmlydHVhbFBhZ2VSb3dDb250cm9sbGVyLnByb3RvdHlwZS5nZXRNb2RlbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBnZXRWaXJ0dWFsUm93OiBmdW5jdGlvbihpbmRleCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhhdC5nZXRWaXJ0dWFsUm93KGluZGV4KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldFZpcnR1YWxSb3dDb3VudDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGF0LnZpcnR1YWxSb3dDb3VudDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBWaXJ0dWFsUGFnZVJvd0NvbnRyb2xsZXI7XHJcbiJdfQ==
