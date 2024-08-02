
var map;
var infoWindow;
var flightArea = [];
// var flightArea2;
var colors = ["#FF0000", "#00FF00", "#0000FF",
    "#00FFFF", "#FF00FF", "#FFFF00",
    "#FFFFFF", "#000000"];
var pointUpdateTimeout = []
var areaResetTimeout = []
var rowEnds = [];
var displayLines = [];
var rowLineColor = [];
var entryAngle = [];
var firstTurn = [];
var rowSeparation = [];
var altitude = [];
var agentIndex = 0;

// console.log(pointUpdateTimeout)

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function toggleHelp() {
    $("#help").toggle();
}

function addAgentSelectEvent() {
    const agentSelect = document.getElementById('agentSelect');
    // let agentIndex = 0;

    agentSelect.addEventListener('change', () => {
        agentIndex = agentSelect.selectedIndex;
        recenterView(agentIndex)
        // console.log('Tes1')
        setTimeout(() => {
            recenterArea(agentIndex);
            // console.log('Tes2')
        }, 500);

        function setInputValue() {
            document.getElementById('angle').value = entryAngle[agentIndex];
            document.getElementById('turn').value = firstTurn[agentIndex];
            document.getElementById('separation').value = rowSeparation[agentIndex];
            document.getElementById('altitude').value = altitude[agentIndex];
            // console.log('ok')
        }

        // Panggil fungsi saat halaman dimuat
        window.onload = setInputValue();
    });
}
function initAgents(numAgents) {
    for (let i = 0; i < numAgents; i++) {
        pointUpdateTimeout.push(null);
        areaResetTimeout.push(null);
        rowEnds.push(0);
        displayLines.push([]);
        rowLineColor.push(colors[(i) % colors.length]);
        entryAngle.push(0);
        firstTurn.push(1);
        rowSeparation.push(20);
        altitude.push(130);
    }
}

function generateAgents(numAgents) {
    var selectElement = document.getElementById("agentSelect");

    for (var i = 1; i <= numAgents; i++) {
        var option = document.createElement("option");
        option.id = "agent" + i;
        option.className = "selectAgent";
        option.value = i - 1; // 0-based index for value
        option.text = "Agent " + i;
        selectElement.appendChild(option);
    }
}

function initMap() {
    let startLat;
    let startLng;

    const modal = document.getElementById("myModal");
    modal.style.display = "block";

    // Get the form
    const form = document.getElementById("myForm");

    // When the form is submitted, close the modal
    form.onsubmit = function (event) {
        event.preventDefault(); // Prevent the default form submission
        modal.style.display = "none";

        numAgents = parseInt(document.getElementById("agents").value);
        startLat = parseFloat(document.getElementById("lat").value);
        startLng = parseFloat(document.getElementById("lon").value);

        // console.log(typeof (numAgents), typeof (startLat), typeof (startLng));
        // console.log((numAgents), (startLat), (startLng));

        initAgents(numAgents);

        // console.log('tes awal')

        map = new google.maps.Map(document.getElementById('map'), {
            center: new google.maps.LatLng(startLat, startLng),
            mapTypeId: 'hybrid',
        });

        // console.log(map + 'ini tes')

        for (let i = 0; i < numAgents; i++) {
            flightArea.push(new google.maps.Polygon({
                paths: [
                    { lat: startLat + 0.001 * (i), lng: startLng + 0.001 * (i) },
                    { lat: startLat + 0.001 * (i + 1), lng: startLng + 0.001 * (i) },
                    { lat: startLat + 0.001 * (i + 1), lng: startLng + 0.001 * (i + 1) },
                    { lat: startLat + 0.001 * (i), lng: startLng + 0.001 * (i + 1) }
                ],
                strokeColor: '#BB0000',
                strokeOpacity: 1,
                strokeWeight: 1,
                fillColor: '#4444BB',
                fillOpacity: 0.2,
                editable: true,
                draggable: true
            }));
            flightArea[i].setMap(map);
            setPathListeners(i);
            queuePointsAreaUpdate(i);
        }

        // document.addEventListener("DOMContentLoaded", function () {
        generateAgents(numAgents); // Change this number to generate more agents
        addAgentSelectEvent();
        // console.log('tes')
        // });

        deleteMenu = new DeleteMenu();

        // Define an info window on the map.
        infoWindow = new google.maps.InfoWindow();

        // setPathListeners(0);
        queuePointsAreaUpdate(0);
        google.maps.event.trigger(map, 'resize');
        recenterView(0);
    };

    // console.log('Ini tes', numAgents, typeof (numAgents))
}

function setPathListeners(agent) {
    google.maps.event.addListener(flightArea[agent].getPath(), 'set_at', function (event) {
        queuePointsAreaUpdate(agent);
    });

    google.maps.event.addListener(flightArea[agent].getPath(), 'insert_at', function (event) {
        queuePointsAreaUpdate(agent);
    });

    google.maps.event.addListener(flightArea[agent], 'rightclick', function (e) {
        // Check if click was on a vertex control point
        if (e.vertex == undefined) {
            return;
        }
        deleteMenu.open(map, flightArea[agent].getPath(), e.vertex);
    });
}

function queuePointsAreaUpdate(agent) {
    clearTimeout(pointUpdateTimeout[agent]);
    clearTimeout(areaResetTimeout[agent]);
    clearDisplayLines(agent);
    pointUpdateTimeout = setTimeout(function () { updatePointsTextarea(agent); updateFlightPath(agent) }, 500);
}

function updatePointsTextarea(agent) {
    var str = "";
    var path = flightArea[agent].getPath();
    //console.log(path.length);
    for (var i = 0; i < path.length; i++) {
        if (i > 0) {
            str += ",\n";
        }
        var loc = path.getAt(i);
        str += loc.lat() + ", " + loc.lng();
    }
    $("#points").val(str);
}

function queueAreaReset(agent) {
    clearTimeout(pointUpdateTimeout);
    clearTimeout(areaResetTimeout);
    // console.log('tes');
    areaResetTimeout = setTimeout(function () { resetAreaFromInput(agent) }, 500);
}

function resetAreaFromInput(agent) {
    $("#feedback").empty();
    var input = $("#points").val();
    var parts = input.split(",");
    if (parts.length % 2 != 0) {
        $("#feedback").html("Need even number of values to interpret as lat/lng points");
        return;
    }
    var pts = [];
    for (var i = 0; i < parts.length; i += 2) {
        var lat = parseFloat(parts[i]);
        var lng = parseFloat(parts[i + 1]);
        if (isNaN(lat) || isNaN(lng)) {
            $("#feedback").html("Need numerical values to interpret as lat/lng points");
            return;
        }
        pts.push({ lat: lat, lng: lng });
    }
    flightArea[agent].setMap(null);
    flightArea[agent].setPaths(pts);
    flightArea[agent].setMap(map);
    setPathListeners(agent);
    updateFlightPath(agent);
}

function recenterView(agent) {
    var markers = flightArea[agent].getPath();
    var bounds = new google.maps.LatLngBounds();
    for (var i = 0; i < markers.length; i++) {
        bounds.extend(markers.getAt(i));
    }
    map.fitBounds(bounds);
}

function recenterArea(agent) {
    var path = flightArea[agent].getPath();
    var bounds = new google.maps.LatLngBounds();
    for (var i = 0; i < path.length; i++) {
        bounds.extend(path.getAt(i));
    }
    var areaCenter = bounds.getCenter();
    var viewCenter = map.getCenter();
    var latDelta = viewCenter.lat() - areaCenter.lat();
    var lngDelta = viewCenter.lng() - areaCenter.lng();
    var pts = [];
    for (var i = 0; i < path.length; i++) {
        var pt = path.getAt(i);
        pts.push({ lat: pt.lat() + latDelta, lng: pt.lng() + lngDelta });
    }
    flightArea[agent].setMap(null);
    flightArea[agent].setPaths(pts);
    flightArea[agent].setMap(map);
    setPathListeners(agent);
    updatePointsTextarea(agent);
    updateFlightPath(agent);
}

function clearDisplayLines(agent) {
    for (var i = 0; i < displayLines[agent].length; i++) {
        displayLines[agent][i].setMap(null);
    }
    displayLines[agent] = [];
}

function updateFlightPath(agent) {

    clearDisplayLines(agent);
    $(`#pathlength`).html("-");
    $(`#efficiency`).html("-");
    $(`#esttime`).html("-");

    var path = flightArea[agent].getPath();
    if (path.length < 3) {
        $(`#feedback`).html("Need at least three points");
        return;
    } else {
        $(`#feedback`).html("");
    }

    // find meters per degree for lat/lng at this location
    var firstPoint = path.getAt(0);
    var p0 = new google.maps.LatLng(firstPoint.lat(), firstPoint.lng());
    var p1 = new google.maps.LatLng(firstPoint.lat() + 0.001, firstPoint.lng());
    var p2 = new google.maps.LatLng(firstPoint.lat(), firstPoint.lng() + 0.001);
    var metersPerLat = 1000 * google.maps.geometry.spherical.computeDistanceBetween(p0, p1);
    var metersPerLng = 1000 * google.maps.geometry.spherical.computeDistanceBetween(p0, p2);

    var pts = [];
    for (var i = 0; i < path.length; i++) {
        var pt = path.getAt(i);
        pts.push({ y: pt.lat(), x: pt.lng() });
    }

    var angle = parseFloat($(`#angle`).val());
    var turn = firstTurn[agent] = parseInt($(`#turn`).val());
    var separation = rowSeparation[agent] = parseFloat($(`#separation`).val());

    while (angle > 360) {
        angle -= 360;
    }
    entryAngle[agent] = angle;

    rowEnds[agent] = generateFlightPath(pts, metersPerLat, metersPerLng, angle, turn, separation);

    var usefulLengthMeters = 0;
    var turningLengthMeters = 0;

    var path = [];
    for (var i = 0; i < rowEnds[agent].length; i++) {
        var row = rowEnds[agent][i];

        var p0 = new google.maps.LatLng(row.start.y, row.start.x);
        var p1 = new google.maps.LatLng(row.end.y, row.end.x);
        usefulLengthMeters += google.maps.geometry.spherical.computeDistanceBetween(p0, p1);

        if (i > 0) {
            var lastRow = rowEnds[agent][i - 1];
            var p2 = new google.maps.LatLng(lastRow.end.y, lastRow.end.x);
            var turnLength = google.maps.geometry.spherical.computeDistanceBetween(p2, p0);
            turningLengthMeters += turnLength;
        }
    }

    var pathLengthMeters = usefulLengthMeters + turningLengthMeters;

    $(`#pathlength`).html(Math.round(pathLengthMeters) + " meters");

    var speed = parseFloat($(`#speed`).val());
    var turntime = parseFloat($(`#turntime`).val());
    var seconds = Math.round(pathLengthMeters / speed);
    seconds += (rowEnds[agent].length - 1) * turntime * 2;

    var usefulSeconds = Math.round(usefulLengthMeters / speed);
    $(`#efficiency`).html(Math.round(100 * usefulSeconds / seconds) + " %");


    var hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    var minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    $(`#esttime`).html(hours + ":" + pad(minutes, 2) + ":" + pad(seconds, 2));

    $(`#totalwaypoints`).html(rowEnds[agent].length * 2);

    drawFlightPath(agent);
}

function drawFlightPath(agent) {

    clearDisplayLines(agent);

    var path = [];
    for (var i = 0; i < rowEnds[agent].length; i++) {
        var row = rowEnds[agent][i];
        var pstart = { lat: row.start.y, lng: row.start.x };
        var pend = { lat: row.end.y, lng: row.end.x };
        path.push(pstart);
        path.push(pend);
    }

    var line = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: rowLineColor[agent],
        strokeOpacity: 1.0,
        strokeWeight: 3,
        zIndex: 100
    });
    line.setMap(map);
    displayLines[agent].push(line);

    // draw arrows
    for (var i = 0; i < rowEnds[agent].length; i++) {
        var row = rowEnds[agent][i];
        var mid = midpoint(row.start, row.end);
        var n = normal(sub(row.end, row.start));
        n = scale(n, -0.00005);
        mid = add(mid, scale(n, -0.5));
        var pn = scale(perp(n), 0.5);
        var p0 = add(mid, add(n, pn));
        var p1 = add(mid, sub(n, pn));
        path = [
            { lat: p0.y, lng: p0.x },
            { lat: mid.y, lng: mid.x },
            { lat: p1.y, lng: p1.x },
        ];
        var line = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: rowLineColor[agent],
            strokeOpacity: 1.0,
            strokeWeight: 3,
            zIndex: 100
        });
        line.setMap(map);
        displayLines[agent].push(line);
    }
}

function downloadMission(formatIndex) {

    var altitude = parseFloat($(`#altitude`).val()).toFixed(1);
    // var filename = $(`#filename`).val();

    // $(`#feedback2`).empty();

    // if (filename.length < 1) {
    //     $(`#feedback2`).html("Enter a file name to save to");
    //     return;
    // }
    for (let agent = 0; agent < numAgents; agent++) {
        let fileContent = "";

        if (formatIndex == 0) {
            fileContent += "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>\n";
            fileContent += "<MISSION>\n";
            fileContent += '<VERSION value="2.3 pre7" />\n';
            var wpNo = 1;
            for (var i = 0; i < rowEnds[agent].length; i++) {
                var row = rowEnds[agent][i];
                fileContent += '<MISSIONITEM no="' + (wpNo++) + '" action="WAYPOINT" parameter1="0" parameter2="0" parameter3="0" lat="' + row.start.y + '" lon="' + row.start.x + '" alt="' + altitude + '" />\n';
                fileContent += '<MISSIONITEM no="' + (wpNo++) + '" action="WAYPOINT" parameter1="0" parameter2="0" parameter3="0" lat="' + row.end.y + '" lon="' + row.end.x + '" alt="' + altitude + '" />\n';
            }
            fileContent += '</MISSION>\n';

        } else if (formatIndex == 1) {
            fileContent += "QGC WPL 110\n";
            var wpNo = 0;
            for (var i = 0; i < rowEnds[agent].length; i++) {
                var row = rowEnds[agent][i];
                fileContent += wpNo + " 0 0 16 0 0 0 0 " + row.start.y + " " + row.start.x + " " + altitude + " 1\n";
                wpNo++;
                fileContent += wpNo + " 0 0 16 0 0 0 0 " + row.end.y + " " + row.end.x + " " + altitude + " 1\n";
                wpNo++;
            }

        } else if (formatIndex == 2) {
            fileContent += "QGC WPL 120\n"; // Header for QGroundControl waypoints file

            var wpNo = 0;
            for (var i = 0; i < rowEnds[agent].length; i++) {
                var row = rowEnds[agent][i];
                fileContent += wpNo + " 0 3 16 0 0 0 0 " + row.start.y + " " + row.start.x + " " + altitude + " 1\n"; // Coordinate frame 3 for global frame
                wpNo++;
                fileContent += wpNo + " 0 3 16 0 0 0 0 " + row.end.y + " " + row.end.x + " " + altitude + " 1\n";
                wpNo++;
            }
        }

        // setTimeout(() => {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(fileContent));
        element.setAttribute('download', `agent${agent + 1}`);
        element.style.display = 'none';

        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
        // }, 2000)

    }
}

function initColorTable() {
    for (var i = 0; i < colors.length; i++) {
        $("#color" + i).css("background-color", colors[i]);
    }
}

function changeColor(agent, i) {
    rowLineColor[agent] = colors[i];
    drawFlightPath(agent);
}

// initAgents();
initColorTable();
initMap();
// recenterView(0);


