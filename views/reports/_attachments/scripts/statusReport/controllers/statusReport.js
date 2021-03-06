// Faraday Penetration Test IDE
// Copyright (C) 2013  Infobyte LLC (http://www.infobytesec.com/)
// See the file 'doc/LICENSE' for the license information

angular.module('faradayApp')
    .controller('statusReportCtrl', 
                    ['$scope', '$filter', '$routeParams',
                    '$location', '$uibModal', '$cookies', '$q', '$window', 'BASEURL',
                    'SEVERITIES', 'EASEOFRESOLUTION', 'hostsManager',
                    'vulnsManager', 'workspacesFact', 'csvService', 'uiGridConstants',
                    function($scope, $filter, $routeParams,
                        $location, $uibModal, $cookies, $q, $window, BASEURL,
                        SEVERITIES, EASEOFRESOLUTION, hostsManager,
                        vulnsManager, workspacesFact, csvService, uiGridConstants) {
        $scope.baseurl;
        $scope.columns;
        $scope.easeofresolution;
        $scope.expression;
        $scope.interfaces;
        $scope.reverse;
        $scope.severities;
        $scope.search;
        $scope.searchParams;
        $scope.sortField;
        $scope.vulns;
        $scope.workspaces;
        $scope.currentPage;
        $scope.newCurrentPage;
        $scope.newPageSize;
        $scope.gridOptions;

        $scope.vulnWebSelected;
        $scope.confirmed = false;
        var allVulns;

        init = function() {
            $scope.baseurl = BASEURL;
            $scope.severities = SEVERITIES;
            $scope.easeofresolution = EASEOFRESOLUTION;
            $scope.propertyGroupBy = $routeParams.groupbyId;
            $scope.sortField = 'metadata.create_time';
            $scope.colProperties = ["date","name","severity","service","target","desc","resolution","data","status","website","path","request","method","params","pname","query","response"];
            $scope.reverse = true;
            $scope.vulns = [];
            $scope.selected = false;

            var deleteRow = '<div ng-if="row.entity._id != undefined" class="ui-grid-cell-contents row-tooltip text-center">'+
                                '<span ng-click="grid.appScope.deleteVuln(row.entity)" class="glyphicon glyphicon-trash cursor" uib-tooltip="Delete"></span>'+
                            '</div>';
            var editRow = '<div ng-if="row.entity._id != undefined" class="ui-grid-cell-contents row-tooltip text-center">'+
                                '<span ng-click="grid.appScope.editVuln(row.entity)" class="glyphicon glyphicon-pencil cursor" uib-tooltip="Edit"></span>'+
                           '</div>';

            var filterRow = '<div ng-if="row.entity._id != undefined" class="ui-grid-cell-contents row-tooltip text-center">'+
                                '<span ng-click="grid.appScope.toggleConfirmVuln(row.entity, row.entity.confirmed)" class="glyphicon glyphicon-filter cursor" uib-tooltip="{{grid.appScope.confirmedTooltip(row.entity.confirmed)}}" tooltip-placement="right" ng-class="{ disabled:row.entity.confirmed === false }"></span>'+
                           '</div>';

            $scope.gridOptions = {
                multiSelect: true,
                enableSelectAll: true,
                enableColumnMenus: false,
                enableRowSelection: true,
                enableRowHeaderSelection: false,
                paginationPageSizes: [10, 50, 75, 100],
                paginationPageSize: 10,
                enableHorizontalScrollbar: 0,
                treeRowHeaderAlwaysVisible: false,
                enableGroupHeaderSelection: true,
                rowHeight: 95
            };
            $scope.gridOptions.columnDefs = [];

            $scope.showObjects = function(object, property, IdEvidence) {
                var partial = "";
                if(angular.isArray(object) === false) {
                    for(key in object) {
                        if(object.hasOwnProperty(key)) {
                            if(object[key] === true) {
                                partial += "<p class='pos-middle crop-text'>" + key +  "</p>";
                            } else if(property === "evidence") {
                                partial += "<p class='pos-middle crop-text'><a href='http://127.0.0.1:5984/"+$scope.workspace+"/"+IdEvidence+"/"+$scope.encodeUrl(key)+"' target='_blank'>" + key +  "</a></p>";
                            }
                        }
                    }
                } else {
                    object.forEach(function(key) {
                        if(key === "") return;
                        if(property === "hostnames") {
                            partial += "<p><a href='//www.shodan.io/search?query=" + key + "' class=\"pos-middle crop-text\" uib-tooltip=\"Search in Shodan\" target=\"_blank\">" +
                            "<img src=\"../././reports/images/shodan.png\" height=\"15px\" width=\"15px\" style=\"margin-left:5px\"/></a>"+
                            "<a href=\""+ $scope.hash + "/search/"+ property +"=" + key + "\">" + key +  "</a></p>";
                        } else if(property === "refs"){
                            partial += "<p class='pos-middle crop-text'><a href='" + $scope.processReference(key) + "' target=\"_blank\">" + key + "</a></p>";
                        } else {
                            partial += "<p class='pos-middle crop-text'>" + key + "</p>";
                        }
                    });
                }
                return partial;
            };

            $scope.gridOptions.onRegisterApi = function(gridApi){
                //set gridApi on scope
                $scope.gridApi = gridApi;
                $scope.gridApi.selection.on.rowSelectionChanged( $scope, function ( rowChanged ) {
                    if ( typeof(rowChanged.treeLevel) !== 'undefined' && rowChanged.treeLevel > -1 ) {
                        // this is a group header
                        children = $scope.gridApi.treeBase.getRowChildren( rowChanged );
                        children.forEach( function ( child ) {
                            if ( rowChanged.isSelected ) {
                                $scope.gridApi.selection.selectRow( child.entity );
                            } else {
                                $scope.gridApi.selection.unSelectRow( child.entity );
                            }
                        });
                    }
                });
                $scope.gridApi.pagination.on.paginationChanged($scope, function (pageNumber, pageSize) {
                    $scope.gridApi.selection.clearSelectedRows();
                });
            };

            // load all workspaces
            workspacesFact.list().then(function(wss) {
                $scope.workspaces = wss;
            });

            // current workspace
            $scope.workspace = $routeParams.wsId;
            $scope.interfaces = [];
            // current search
            $scope.search = $routeParams.search;
            $scope.searchParams = "";
            $scope.expression = {};
            if($cookies.get('confirmed') === 'true') $scope.confirmed = true;
            if($scope.confirmed === true) {
                if($scope.search !== undefined) {
                    $scope.search = $scope.search.concat("&confirmed=true");
                } else {
                    $scope.search = "confirmed=true";
                }
            }
            if($scope.search != "" && $scope.search != undefined && $scope.search.indexOf("=") > -1) {
                // search expression for filter
                $scope.expression = $scope.decodeSearch($scope.search);
                // search params for search field, which shouldn't be used for filtering
                $scope.searchParams = $scope.stringSearch($scope.expression);
            }
            $scope.hash = window.location.hash;
            if(window.location.hash.substring(1).indexOf('search') !== -1) {
                $scope.hash = $scope.hash.slice(0, window.location.hash.indexOf('search') - 1);
            }

            // load all vulnerabilities
            vulnsManager.getVulns($scope.workspace).then(function(vulns) {
                tmp_data = $filter('orderObjectBy')(vulnsManager.vulns, $scope.propertyGroupBy, true);
                $scope.gridOptions.data = $filter('filter')(tmp_data, $scope.expression);

                $scope.gridOptions.total = vulns.length;
                if($scope.gridOptions.total > $scope.gridOptions.paginationPageSize && $scope.gridOptions.total > 100) {
                    $scope.gridOptions.paginationPageSizes.push($scope.gridOptions.total);
                }
            });

            // created object for columns cookie columns
            if(typeof($cookies.get('SRcolumns')) != 'undefined'){
                var objectoSRColumns = {};
                var arrayOfColumns = $cookies.get('SRcolumns').replace(/[{}"']/g, "").split(',');
                arrayOfColumns.forEach(function(column){
                    var columnFinished = column.split(':');
                    if(columnFinished[1] == "true") objectoSRColumns[columnFinished[0]] = true; else objectoSRColumns[columnFinished[0]] = false;
                });
            }
            // set columns to show and hide by default
            $scope.columns = objectoSRColumns || {
                "date":             true,
                "name":             true,
                "severity":         true,
                "service":          true,
                "target":           true,
                "desc":             true,
                "resolution":       false,
                "data":             true,
                "easeofresolution": false,
                "status":           false,
                "website":          false,
                "path":             false,
                "request":          false,
                "refs":             true,
                "evidence":         false,
                "hostnames":        false,
                "impact":           false,
                "method":           false,
                "params":           false,
                "pname":            false,
                "query":            false,
                "response":         false,
                "web":              false
            };
            $scope.gridOptions.columnDefs.push({ name: '   ', width: '20', headerCellTemplate: "<i class=\"fa fa-check cursor\" ng-click=\"grid.appScope.selectAll()\" ng-style=\"{'opacity':(grid.appScope.selected === true) ? '1':'0.6'}\"></i>", pinnedLeft:true });
            $scope.gridOptions.columnDefs.push({ name: '    ', width: '40', cellTemplate: filterRow });
            $scope.gridOptions.columnDefs.push({ name: ' ', width: '40', cellTemplate: deleteRow });
            $scope.gridOptions.columnDefs.push({ name: '  ', width: '30', cellTemplate: editRow });
            var count = 0;
            for(key in $scope.columns) {
                if($scope.columns.hasOwnProperty(key) && $scope.columns[key] == true) {
                    count++;
                    _addColumn(key);
                    if(key === $scope.propertyGroupBy) {
                        $scope.gridOptions.columnDefs[count + 3].grouping = { groupPriority: 0 };
                        $scope.gridOptions.columnDefs[count + 3].sort = { priority: 0, direction: 'asc' }
                    }
                }
            }
            $scope.vulnWebSelected = false;
        };

        _addColumn = function(column) {

            var myHeader = "<div ng-class=\"{ 'sortable': sortable }\">"+
                                "<div class=\"ui-grid-cell-contents\" col-index=\"renderIndex\" title=\"TOOLTIP\">{{ col.displayName CUSTOM_FILTERS }}"+
                                    "<a href=\"\" ng-click=\"grid.appScope.toggleShow(col.displayName, true)\"><span style=\"color:#000;\" class=\"glyphicon glyphicon-remove\"></span></a>"+
                                    "<span ui-grid-visible=\"col.sort.direction\" ng-class=\"{ 'ui-grid-icon-up-dir': col.sort.direction == asc, 'ui-grid-icon-down-dir': col.sort.direction == desc, 'ui-grid-icon-blank': !col.sort.direction }\">&nbsp;</span>"+
                                "</div>"+
                                "<div class=\"ui-grid-column-menu-button\" ng-if=\"grid.options.enableColumnMenus && !col.isRowHeader  && col.colDef.enableColumnMenu !== false\" ng-click=\"toggleMenu($event)\" ng-class=\"{'ui-grid-column-menu-button-last-col': isLastCol}\">"+
                                    "<i class=\"ui-grid-icon-angle-down\">&nbsp;</i>"+
                                "</div>"+
                                "<div ui-grid-filter></div>"
                            "</div>";

            if(column === 'date') {
                $scope.gridOptions.columnDefs.push({ 'name' : 'metadata.create_time', 'displayName' : column, type: 'date', cellFilter: 'date:"MM/dd/yyyy"', headerCellTemplate: myHeader, width: '90'
                });
            } else if(column === 'name') {
                $scope.gridOptions.columnDefs.push({ 'name' : column,
                'cellTemplate': '<div ng-if="row.entity._id != undefined"><div ng-if="!col.grouping || col.grouping.groupPriority === undefined || col.grouping.groupPriority === null || ( row.groupHeader && col.grouping.groupPriority === row.treeLevel )" class="ui-grid-cell-contents white-space" uib-tooltip="{{COL_FIELD}}"><a ng-href=' + $scope.hash + '/search/name={{row.entity.name}}>{{COL_FIELD CUSTOM_FILTERS}}</a></div></div><div ng-if=\"row.groupHeader && col.grouping.groupPriority !== undefined\" class="ui-grid-cell-contents white-space">{{COL_FIELD CUSTOM_FILTERS}}</div>',
                headerCellTemplate: myHeader,
                maxWidth: '230'
                });
            } else if(column === 'severity') {
                    $scope.gridOptions.columnDefs.push({ 'name' : column,
                        'cellTemplate': '<div ng-if="row.entity._id != undefined">'+
                            '<div ng-if="!col.grouping || col.grouping.groupPriority === undefined || col.grouping.groupPriority === null || ( row.groupHeader && col.grouping.groupPriority === row.treeLevel )" class="ui-grid-cell-contents text-center"><a href=\"#/status/ws/' + $scope.workspace + '/search/severity={{COL_FIELD}}\"><span class=\"label vuln fondo-{{COL_FIELD}}\">{{COL_FIELD | uppercase}}</span></a></div>'+
                        '</div>'+
                        '<div ng-if=\"row.groupHeader && col.grouping.groupPriority !== undefined\"><span class=\"label vuln fondo-{{COL_FIELD}}\">{{COL_FIELD | uppercase}}</span></div>',
                        headerCellTemplate: myHeader,
                        type: 'string',
                        width: '110',
                        sortingAlgorithm: compareSeverities
                    });
            } else if(column === 'target') {
                $scope.gridOptions.columnDefs.push({ 'name' : column, 'cellTemplate': "<div ng-if='row.entity._id != undefined' class='ui-grid-cell-contents row-tooltip'><a ng-href=" + $scope.hash + "/search/target={{row.entity.target}}>{{COL_FIELD CUSTOM_FILTERS}}</a>" +
                    "<a ng-href=\"//www.shodan.io/search?query={{row.entity.target}}\" uib-tooltip=\"Search in Shodan\" target=\"_blank\">" +
                        "<img ng-src=\"../././reports/images/shodan.png\" height=\"15px\" width=\"15px\" style='margin-left:5px'/>" +
                    "</a></div>"+
                    "<div ng-if=\"row.groupHeader && col.grouping.groupPriority !== undefined\">{{COL_FIELD CUSTOM_FILTERS}}</div>", headerCellTemplate: myHeader,
                    width: '115',
                });
            } else if(column === 'impact' || column === 'refs' || column === 'hostnames') {
                $scope.gridOptions.columnDefs.push({ 'name' : column, 'displayName': column, 'cellTemplate': "<div class=\"ui-grid-cell-contents center\" ng-bind-html=\"grid.appScope.showObjects(COL_FIELD, col.name)\"></div><div ng-if=\"row.groupHeader && col.grouping.groupPriority !== undefined\">{{COL_FIELD CUSTOM_FILTERS}}</div>", headerCellTemplate: myHeader });
            } else if(column === 'evidence') {
                $scope.gridOptions.columnDefs.push({ 'name' : column, 'displayName': column, 'cellTemplate': "<div class=\"ui-grid-cell-contents center\" ng-bind-html=\"grid.appScope.showObjects(row.entity._attachments, col.name, row.entity._id)\"></div><div ng-if=\"row.groupHeader && col.grouping.groupPriority !== undefined\">{{COL_FIELD CUSTOM_FILTERS}}</div>", headerCellTemplate: myHeader });
            } else if(column === 'service') {
                $scope.gridOptions.columnDefs.push({ 'name' : column, 'displayName': column, 'cellTemplate': "<div class='ui-grid-cell-contents'><a href=" + $scope.hash + "/search/service={{grid.appScope.encodeUrl(row.entity.service)}}>{{COL_FIELD CUSTOM_FILTERS}}</a></div><div ng-if='row.groupHeader && col.grouping.groupPriority !== undefined'>{{COL_FIELD CUSTOM_FILTERS}}</div>", headerCellTemplate: myHeader, width: '110' });
            } else if(column === 'web') {
                $scope.gridOptions.columnDefs.push({ 'name' : column, 'displayName': column, width: '80',
                'cellTemplate': "<div ng-if='row.entity._id != undefined' class=\"ui-grid-cell-contents center\">"+
                    "<span class=\"glyphicon glyphicon-ok\" ng-show=\"row.entity.type === 'VulnerabilityWeb'\"></span>"+
                    "<span class=\"glyphicon glyphicon-remove\" ng-show=\"row.entity.type !== 'VulnerabilityWeb'\"></span>"+
                "</div>",
                 headerCellTemplate: myHeader
                });
            } else if(column === 'desc') {
                $scope.gridOptions.columnDefs.push({ 'name' : column, headerCellTemplate: myHeader,
                cellTemplate: '<div><div ng-if="!col.grouping || col.grouping.groupPriority === undefined || col.grouping.groupPriority === null || ( row.groupHeader && col.grouping.groupPriority === row.treeLevel )" class="ui-grid-cell-contents overflow-cell white-space" uib-tooltip=\"{{grid.appScope.ifTooltip(COL_FIELD)}}\">{{COL_FIELD CUSTOM_FILTERS}}</div></div>',
                minWidth: '300',
                maxWidth: '400'
                });
            } else if(column === 'data' || column === 'resolution' || column === 'request' || column === 'response') {
                $scope.gridOptions.columnDefs.push({ 'name' : column, headerCellTemplate: myHeader,
                cellTemplate: '<div><div ng-if="!col.grouping || col.grouping.groupPriority === undefined || col.grouping.groupPriority === null || ( row.groupHeader && col.grouping.groupPriority === row.treeLevel )" class="ui-grid-cell-contents white-space" uib-tooltip="{{COL_FIELD}}">{{COL_FIELD CUSTOM_FILTERS}}</div></div>'
                });
            } else {
                $scope.gridOptions.columnDefs.push({ 'name' : column, headerCellTemplate: myHeader,
                cellTemplate: '<div ng-if="row.entity._id != undefined"><div ng-if="!col.grouping || col.grouping.groupPriority === undefined || col.grouping.groupPriority === null || ( row.groupHeader && col.grouping.groupPriority === row.treeLevel )" class="ui-grid-cell-contents white-space" uib-tooltip="{{COL_FIELD}}"><a href=' + $scope.hash + '/search/{{col.name}}={{grid.appScope.encodeUrl(row.entity[col.name])}}>{{COL_FIELD CUSTOM_FILTERS}}</a></div></div><div ng-if=\"row.groupHeader && col.grouping.groupPriority !== undefined\" class="ui-grid-cell-contents white-space">{{COL_FIELD CUSTOM_FILTERS}}</div>', });
            }
        };

        $scope.ifTooltip = function(text) {
            if(text !== undefined && text.length > 450) {
                return text;
            }
        };

        $scope.confirmedTooltip = function(isConfirmed) {
            var res = "";
            if(isConfirmed === true) {
                res = "Change to false positive";
            } else {
                res = "Confirm";
            }
            return res;
        };

        $scope.selectAll = function() {
            if($scope.selected === false) {
                for(var i = 0; i <= $scope.gridOptions.paginationPageSize; i++) {
                    $scope.gridApi.selection.selectRowByVisibleIndex(i);
                }
                $scope.selected = true;
            } else {
                $scope.gridApi.selection.clearSelectedRows();
                var allVisibleRows = $scope.gridApi.core.getVisibleRows($scope.gridApi);
                allVisibleRows.forEach(function(row) {
                    if(row.groupHeader === true && row.isSelected === true) {
                        row.isSelected = false;
                    }
                });
                $scope.selected = false;
            }
        };
     
        $scope.processReference = function(text) {
            var url = 'http://google.com/',
            url_pattern = new RegExp('^(http|https):\\/\\/?');

            var cve_pattern = new RegExp(/^CVE-\d{4}-\d{4,7}$/),
            cwe_pattern = new RegExp(/^CWE(-|:)\d{1,7}$/),
            edb_pattern = new RegExp(/^EDB-ID:\s?\d{1,}$/),
            osvdb_pattern = new RegExp(/^OSVDB:\s?\d{1,}$/);

            var cve = text.search(cve_pattern),
            cwe = text.search(cwe_pattern),
            edb = text.search(edb_pattern),
            osvdb = text.search(osvdb_pattern);

            if(url_pattern.test(text)) {
                url = text;
            } else if(cve > -1) {
                url = "https://cve.mitre.org/cgi-bin/cvename.cgi?name=" + text.substring(cve + 4);
            } else if(cwe > -1) {
                url = "https://cwe.mitre.org/data/definitions/" + text.substring(cwe + 4) + ".html";
            } else if(osvdb > -1) {
                url = "http://osvdb.org/show/osvdb/" + text.substring(osvdb + 6);
            } else if(edb > -1) {
                url = "https://www.exploit-db.com/exploits/" + text.substring(edb + 7);
            } else {
                url += 'search?q=' + text;
            }
            
            return url;
        };

        $scope.groupBy = function(property) {
            var url = "/status/ws/" + $routeParams.wsId + "/groupby/" + property;

            $location.path(url);
        };

        $scope.clearGroupBy = function() {
            var url = "/status/ws/" + $routeParams.wsId;

            $location.path(url);
        };

        $scope.getCurrentSelection = function() {
            return $scope.gridApi.selection.getSelectedRows();
        };

        $scope.encodeUrl = function(text) {
            return encodeURIComponent(encodeURIComponent(text));
        };

        $scope.csv = function() {
            tmp_vulns = $filter('filter')($scope.gridOptions.data, $scope.expression);
            return csvService.generator($scope.columns, tmp_vulns, $scope.workspace);
        };

        $scope.toggleFilter = function(expression) {
            if(expression["confirmed"] === undefined) {
                expression["confirmed"] = true;
                $scope.expression = expression;
                $cookies.put('confirmed', $scope.expression.confirmed);
                loadVulns();
                $scope.confirmed = true;
            } else {
                $scope.expression = {};
                for(key in expression) {
                    if(expression.hasOwnProperty(key)) {
                        if(key !== "confirmed") {
                            $scope.expression[key] = expression[key];
                        }
                    }
                }
                $cookies.put('confirmed', $scope.expression.confirmed);
                loadVulns();
                $scope.confirmed = false;
            }
        };

        showMessage = function(msg) {
            var modal = $uibModal.open({
                    templateUrl: 'scripts/commons/partials/modalKO.html',
                    controller: 'commonsModalKoCtrl',
                    resolve: {
                        msg: function() {
                            return msg;
                        }
                    }
                });
        }

        // deletes the vulns in the array
        $scope.remove = function(aVulns) {
            aVulns.forEach(function(vuln) {
                vulnsManager.deleteVuln(vuln)
                    .then(function() {
                        loadVulns();
                    })
                    .catch(function(errorMsg) {
                        // TODO: show errors somehow
                        console.log("Error deleting vuln " + vuln._id + ": " + errorMsg);
                    });
            });
        };


        // action triggered from DELETE button
        $scope.delete = function() {
            _delete($scope.getCurrentSelection());
        };
        // delete only one vuln
        $scope.deleteVuln = function(vuln) {
            _delete([vuln]);
        };

        _delete = function(vulns) {
            if(vulns.length > 0) {
                var modal = $uibModal.open({
                    templateUrl: 'scripts/commons/partials/modalDelete.html',
                    controller: 'commonsModalDelete',
                    size: 'lg',
                    resolve: {
                        msg: function() {
                            var msg = "";
                            if(vulns.length == 1) {
                                msg = "A vulnerability will be deleted.";
                            } else {
                                msg = vulns.length + " vulnerabilities will be deleted.";
                            }
                            msg += " This action cannot be undone. Are you sure you want to proceed?";
                            return msg;
                        }
                    }
                });

                modal.result.then(function() {
                    $scope.remove(vulns);
                });
            } else {
                showMessage('No vulnerabilities were selected to delete');
            }
        };

        $scope.toggleConfirmVuln = function(vuln, confirm) {
            _toggleConfirm([vuln], confirm);
        };

        _toggleConfirm = function(vulns, confirm) {
            var toggleConfirm = {'confirmed': !confirm},
            deferred = $q.defer(),
            promises = [];
            vulns.forEach(function(vuln) {
                promises.push(vulnsManager.updateVuln(vuln, toggleConfirm));
            });
            $q.all(promises).then(function(res) {
                if(confirm === true) {
                    loadVulns();
                }
            }, function(errorMsg){
                showMessage("Error updating vuln " + vuln.name + " (" + vuln._id + "): " + errorMsg);
            });
        };

        // action triggered from EDIT button
        $scope.edit = function() {
            _edit($scope.getCurrentSelection());
        };

        $scope.editVuln = function(vuln) {
            _edit([vuln]);
        };

        _edit = function(vulns) {
           if (vulns.length == 1) {
                var modal = $uibModal.open({
                    templateUrl: 'scripts/statusReport/partials/modalEdit.html',
                    controller: 'modalEditCtrl as modal',
                    size: 'lg',
                    resolve: {
                        severities: function() {
                            return $scope.severities;
                        },
                        vuln: function() {
                            return vulns[0];
                        }
                    }
                });
                modal.result.then(function(data) {
                    vulnsManager.updateVuln(vulns[0], data).then(function(){
                    }, function(errorMsg){
                        showMessage("Error updating vuln " + vulns[0].name + " (" + vulns[0]._id + "): " + errorMsg);
                    });
       
                });
            } else {
                showMessage('A vulnierabilty must be selected in order to edit');
            }
        };

        var editProperty = function(partial, controller, message, property, opts) {
            if(opts == undefined) {
                opts = {};
            }
            var resolve = {
                msg: function() {
                    return message;
                },
                options: function() {
                    return opts.options;
                }
            };
            var modal = $uibModal.open({
                templateUrl: partial,
                controller: controller,
                size: 'lg',
                resolve: resolve
            });
            modal.result.then(function(data) {
                $scope.getCurrentSelection().forEach(function(vuln) {
                    obj = {};
                    obj[property] = data;

                    if (opts.callback != undefined){
                        obj = opts.callback(vuln, data);
                    }

                    vulnsManager.updateVuln(vuln, obj).then(function(vulns){
                    }, function(errorMsg){
                        // TODO: show errors somehow
                        console.log("Error updating vuln " + vuln._id + ": " + errorMsg);
                    });
                });
            });
        }
        
        $scope.editSeverity = function() {
            editProperty(
                'scripts/commons/partials/editOptions.html',
                'commonsModalEditOptions',
                'Enter the new severity:',
                'severity',
                {options: SEVERITIES});
        };

        $scope.editEaseofresolution = function() {
            editProperty(
                'scripts/commons/partials/editOptions.html',
                'commonsModalEditOptions',
                'Enter the new easeofresolution:',
                'easeofresolution',
                {options: EASEOFRESOLUTION});
        };

        $scope.editReferences = function() {
            editProperty(
                'scripts/commons/partials/editArray.html',
                'commonsModalEditArray',
                'Enter the new references:',
                'refs',
                {callback: function (vuln, refs) {
                    var references = vuln.refs.concat([]);
                    refs.forEach(function(ref) {
                        if(vuln.refs.indexOf(ref) == -1){
                            references.push(ref);
                        }
                    });

                    return {'refs': references};
                }}
                );
        };

        $scope.editImpact = function() {
            editProperty(
                'scripts/commons/partials/editObject.html',
                'commonsModalEditObject',
                'Enter the new impact:',
                'impact',
                {
                    options: {
                        accountability: false,
                        availability: false,
                        confidentiality: false,
                        integrity: false
                    },
                    callback: function (vuln, impacts) {
                        var impact = {};
                        for(key in vuln.impact){
                            if(vuln.impact.hasOwnProperty(key)) {
                                impact[key] = vuln.impact[key];
                                if(impacts.hasOwnProperty(key)) {
                                    impact[key] = impacts[key];
                                }
                            }
                        }
                        return {'impact': impact};
                    }
                }
                );
        };

        $scope.editString = function(property, message_word) {
            var message;
            if(message_word) {
                message = 'Enter the new ' + message_word + ':';
            } else {
                message = 'Enter the new ' + property + ':';
            }
            editProperty(
                'scripts/commons/partials/editString.html',
                'commonsModalEditString',
                message,
                property);
        };

        $scope.editText = function(property, message_word) {
            var message;
            if(message_word) {
                message = 'Enter the new ' + message_word + ':';
            } else {
                message = 'Enter the new ' + property + ':';
            }
            editProperty(
                'scripts/commons/partials/editText.html',
                'commonsModalEditString',
                message,
                property);
        };

        $scope.editConfirm = function() {
            editProperty(
                'scripts/commons/partials/editOptions.html',
                'commonsModalEditOptions',
                'Confirm/Change to false positive:',
                'confirmed',
                {
                    options: ['Confirm', 'Set to false positive'],
                    callback: function(vuln, data) {
                        var property;
                        if(data === 'Confirm') {
                            property = {'confirmed': true};
                        } else {
                            property = {'confirmed': false};
                        }
                        return property;
                    }
                }
                );

        };

        $scope.editCWE = function() {
            var modal = $uibModal.open({
                templateUrl: 'scripts/commons/partials/editCWE.html',
                controller: 'commonsModalEditCWE',
                size: 'lg',
                resolve: {
                    msg: function() {
                        return 'CWE template';
                    }
                }
            });
            modal.result.then(function(data) {
                $scope.selectedVulns().forEach(function(vuln) {
                    var references = vuln.refs.concat([]);
                    data.refs.forEach(function(ref) {
                        if(vuln.refs.indexOf(ref) == -1){
                            references.push(ref);
                        }
                    });
                    data.refs = references;                    

                    vulnsManager.updateVuln(vuln, data).then(function(vulns){
                    }, function(errorMsg){
                        // TODO: show errors somehow
                        console.log("Error updating vuln " + vuln._id + ": " + errorMsg);
                    });
                });
            });
        };

        $scope.insert = function(vuln) {
            vulnsManager.createVuln($scope.workspace, vuln).then(function() {
                loadVulns();
            }, function(message) {
                var msg = "The vulnerability couldn't be created";
                if(message == "409") {
                    msg += " because a vulnerability with the same parameters already exists in this Workspace";
                }
                showMessage(msg);
            });
            /*
            // this shouldnt be necessary, we should use Angular formatting options directly in the partial
            //formating the date
            var d = new Date(0);
            d.setUTCSeconds(vuln.date);
            d = d.getDate() + "/" + (d.getMonth()+1) + "/" + d.getFullYear();
            vuln.date = d;
            */
        };

        loadVulns = function(property) {
            // load all vulnerabilities
            if (!property) property = "name";
            tmp_data = $filter('orderObjectBy')(vulnsManager.vulns, property, true);
            $scope.gridOptions.data = $filter('filter')(tmp_data, $scope.expression);
        };

        $scope.new = function() {
            var modal = $uibModal.open({
                templateUrl: 'scripts/statusReport/partials/modalNew.html',
                controller: 'modalNewVulnCtrl as modal',
                size: 'lg',
                resolve: {
                    severities: function() {
                        return $scope.severities;
                    },
                    workspace: function() {
                        return $scope.workspace;
                    }
                }
             });

            modal.result.then(function(data) {
                $scope.insert(data);
            });
        };

        // encodes search string in order to send it through URL
        $scope.encodeSearch = function(search) {
            var i = -1,
            encode = "",
            params = search.split(" "),
            chunks = {};

            params.forEach(function(chunk) {
                i = chunk.indexOf(":");
                if(i > 0) {
                    chunks[chunk.slice(0, i)] = chunk.slice(i+1);
                } else {
                    if(!chunks.hasOwnProperty("free")) {
                        chunks.free = "";
                    }
                    chunks.free += " ".concat(chunk);
                }
            });

            if(chunks.hasOwnProperty("free")) {
                chunks.free = chunks.free.slice(1);
            }

            for(var prop in chunks) {
                if(chunks.hasOwnProperty(prop)) {
                    if(chunks.prop != "") {
                        encode += "&" + encodeURIComponent(prop) + "=" + encodeURIComponent(chunks[prop]);
                    }
                }
            }
            return encode.slice(1);
        };

        // decodes search parameters to object in order to use in filter
        $scope.decodeSearch = function(search) {
            var i = -1,
            decode = {},
            params = search.split("&");

            params.forEach(function(param) {
                i = param.indexOf("=");
                decode[decodeURIComponent(param.slice(0,i))] = decodeURIComponent(param.slice(i+1));
            });

            if(decode.hasOwnProperty("free")) {
                decode['$'] = decode.free;
                delete decode.free;
            }

            return decode;
        };

        // converts current search object to string to be displayed in search field
        $scope.stringSearch = function(obj) {
            var search = "";

            for(var prop in obj) {
                if(obj.hasOwnProperty(prop)) {
                    if(search != "") {
                        search += " ";
                    }
                    if(prop == "$") {
                        search += obj[prop];
                    } else {
                        if(prop !== "confirmed"){
                            search += prop + ":" + obj[prop];
                        }
                    }
                }
            }

            return search;
        };

        // changes the URL according to search params
        $scope.searchFor = function(search, params) {
            if(window.location.hash.substring(1).indexOf('groupby') === -1) {
                var url = "/status/ws/" + $routeParams.wsId;
            } else {
                var url = "/status/ws/" + $routeParams.wsId + "/groupby/" + $routeParams.groupbyId;
            }

            if(search && params != "" && params != undefined) {
                url += "/search/" + $scope.encodeSearch(params);
            }

            $location.path(url);
        };
        
        // toggles column show property
        $scope.toggleShow = function(column, show) {
            column = column.toLowerCase();
            $scope.columns[column] = !show;
            for (i = 0;i < $scope.gridOptions.columnDefs.length; i++) {
                if($scope.gridOptions.columnDefs[i].name === column) {
                    $scope.gridOptions.columnDefs.splice(i, 1);
                } else {
                    if(show === false) {
                        _addColumn(column);
                        break;
                    }
                }
            }
            $cookies.put('SRcolumns', JSON.stringify($scope.columns));
        };

        var compareSeverities = function(a, b) {
            if(a !== 'undefined' || b !== 'undefined') {
                var res = 1;
                if($scope.severities.indexOf(a) === $scope.severities.indexOf(b)) { return 0; }
                if($scope.severities.indexOf(a) > $scope.severities.indexOf(b)) {
                  res = -1;
                }
                return res;
            }
        };

        init();
    }]);
