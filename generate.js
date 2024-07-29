
function perp(vec) {
    return { x:-vec.y, y:vec.x };
}

function negate(vec) {
    return { x:-vec.x, y:-vec.y };
}

function dot(v0, v1) {
    return v0.x * v1.x + v0.y * v1.y;
}

function areVecsEqual(v0, v1) {
    return v0.x == v1.x && v0.y == v1.y;
}

function add(a, b) {
    return { x:a.x + b.x, y:a.y + b.y };
}

function sub(a, b) {
    return { x:a.x - b.x, y:a.y - b.y };
}

function scale(vec, s) {
    return { x:vec.x * s, y:vec.y * s };
}

function dist(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt( dx*dx + dy*dy );
}

function midpoint(a, b) {
    return { x:0.5 * (a.x+b.x), y:0.5*(a.y+b.y) };
}

function normal(vec) {
    var len = Math.sqrt( vec.x*vec.x + vec.y*vec.y );
    if (len == 0) {
        return {x:0,y:0};
    }
    return scale(vec, 1/len);
}

// Find the intersection between two lines v0-v1 and t0-t1.
// If no intersection exists return null, otherwise return
// an object like:
//
//    {
//      frac: 0.35,
//      point: {x:1.23, y:4.56}
//    }
//
// where 'point' is the intersection point, and 'frac' is
// the fraction of v0-v1 at which the intersection occurs.
// Eg. a fraction of 0.25 means the intersection is one
// quarter the way along the line going from v0 to v1.
function linesCross(v0, v1, t0, t1)
{
    if ( areVecsEqual(v1,t0) ||
         areVecsEqual(v0,t0) ||
         areVecsEqual(v1,t1) ||
         areVecsEqual(v0,t1) )
        return null;

    var vnormal = sub(v1, v0);
    vnormal = perp(vnormal);
    var v0d = dot(vnormal, v0);
    var t0d = dot(vnormal, t0);
    var t1d = dot(vnormal, t1);
    if ( t0d > v0d && t1d > v0d )
        return null;
    if ( t0d < v0d && t1d < v0d )
        return null;

    var tnormal = sub(t1, t0);
    tnormal = perp(tnormal);
    t0d = dot(tnormal, t0);
    v0d = dot(tnormal, v0);
    var v1d = dot(tnormal, v1);
    if ( v0d > t0d && v1d > t0d )
        return null;
    if ( v0d < t0d && v1d < t0d )
        return null;
    
    var fullvec = sub(v1,v0);
    var frac = (t0d-v0d)/(v1d-v0d);
    
    return { frac:frac, point: add(v0, scale(fullvec,frac)) };
}

// Given a polygon in lat/lon coordinates, generate a flight path
// according to the desired angle and separation parameters.
//
//     points: an array of three or more objects like {x:1.23, y:4.56}
//           where x and y correspond to lon and lat respectively.
//     metersPerLat: number of meters per degree of latitude at this location
//     metersPerLng: number of meters per degree of longitude at this location
//     angle: desired angle of flight of first row, 0 being north, 90 being east
//     turn: desired direction to turn at the end of the first row, 0=left, 1=right
//     separation: desired separation in meters between rows
//
// The metersPerLat/Lng values are necessary because the user will want to define
// the row separation in meters, but the flight path will be defined in lat/lon
// coordinates, and the relation between these dimensions is not constant worldwide.
// The final meters per degree value used will also depend on the angle of the rows.
// For example, if the rows run exactly north-south, then metersPerLat will be used,
// if the rows run exactly west-east then metersPerLng will be used. For any other
// angle a value interpolated between them will be used.
//
// Returns an array of point pairs, each representing one row of the flight path, eg:
//
//    [
//      {
//        start: {x:1.23, y:4.56},
//        end:   {x:7.89, y:0.12},
//      },
//      {
//        start: {x:1.23, y:4.56},
//        end:   {x:7.89, y:0.12},
//      }
//    ]
//
// The full flight path can then be constructed by joining consecutive rows.
function generateFlightPath(points, metersPerLat, metersPerLng, angle, turn, separation) {
    
    // get vector parallel to rows
    var rad = angle * Math.PI / 180;
    var parallelVec = { x: Math.sin(rad), y: Math.cos(rad) };
    
    // get vector perpendicular to strips
    var perpVec = perp(parallelVec);
    if ( turn == 1 ) {
        perpVec = negate(perpVec);
    }
    
    //find extents in parallel and perp directions
    var minParallel, maxParallel, minPerp, maxPerp;
    var minParallelInd, maxParallelInd, minPerpInd, maxPerpInd;
    for (var i = 0; i < points.length; i++) {
        var pt = points[i];
        var parallelDot = dot(pt,parallelVec);
        var perpDot = dot(pt,perpVec);
        if ( i == 0 ) {
            minParallel = maxParallel = parallelDot;
            minPerp = maxPerp = perpDot;
            minParallelInd = maxParallelInd = 0;
            minPerpInd = maxPerpInd = 0;
        }
        else {
            if (parallelDot < minParallel) {
                minParallel = parallelDot;
                minParallelInd = i;
            }
            if (parallelDot > maxParallel) {
                maxParallel = parallelDot;
                maxParallelInd = i;
            }
            if (perpDot < minPerp) {
                minPerp = perpDot;
                minPerpInd = i;
            }
            if (perpDot > maxPerp) {
                maxPerp = perpDot;
                maxPerpInd = i;
            }
        }
    }
    
    // get row separation in lat/lng dimension (along perpVec)
    var quadrantAngle = angle;
    if (quadrantAngle > 180) {
        quadrantAngle = 360 - quadrantAngle;
    }
    if (quadrantAngle > 90) {
        quadrantAngle = 180 - quadrantAngle;
    }
    var lngToLatRatio = quadrantAngle / 90;
    var latLngSeparationPerDegree = metersPerLng + lngToLatRatio * (metersPerLat - metersPerLng);
    var latLngSeparation = separation / latLngSeparationPerDegree;
    
    // find corners of oriented bounding box
    var parallelMinPoint = points[minParallelInd];
    var parallelMaxPoint = points[maxParallelInd];
    var perpMinPoint = points[minPerpInd];
    var perpMaxPoint = points[maxPerpInd];
    
    var parallelMinExtended1 = add(parallelMinPoint, scale(perpVec,-10000));
    var parallelMinExtended2 = add(parallelMinPoint, scale(perpVec, 10000));
    var parallelMaxExtended1 = add(parallelMaxPoint, scale(perpVec,-10000));
    var parallelMaxExtended2 = add(parallelMaxPoint, scale(perpVec, 10000));
    
    var perpMinExtended1 = add(perpMinPoint, scale(parallelVec,-10000));
    var perpMinExtended2 = add(perpMinPoint, scale(parallelVec, 10000));
    var perpMaxExtended1 = add(perpMaxPoint, scale(parallelVec,-10000));
    var perpMaxExtended2 = add(perpMaxPoint, scale(parallelVec, 10000));
    
    parallelMinExtended1 = add(parallelMinExtended1, scale(parallelVec, -0.0001));
    parallelMinExtended2 = add(parallelMinExtended2, scale(parallelVec, -0.0001));
    parallelMaxExtended1 = add(parallelMaxExtended1, scale(parallelVec,  0.0001));
    parallelMaxExtended2 = add(parallelMaxExtended2, scale(parallelVec,  0.0001));
    
    perpMinExtended1 = add(perpMinExtended1, scale(perpVec,  latLngSeparation*0.5));
    perpMinExtended2 = add(perpMinExtended2, scale(perpVec,  latLngSeparation*0.5));
        
    var lxlyInt = linesCross(parallelMinExtended1, parallelMinExtended2, perpMinExtended1, perpMinExtended2);
    var uxlyInt = linesCross(parallelMinExtended1, parallelMinExtended2, perpMaxExtended1, perpMaxExtended2);
    var uxuyInt = linesCross(parallelMaxExtended1, parallelMaxExtended2, perpMaxExtended1, perpMaxExtended2);
    var lxuyInt = linesCross(parallelMaxExtended1, parallelMaxExtended2, perpMinExtended1, perpMinExtended2);
        
    var lxly = lxlyInt.point;
    var uxly = uxlyInt.point;
    var uxuy = uxuyInt.point;
    var lxuy = lxuyInt.point;
    
    var perpDist = dist(lxly,uxly);
    var rowsNeeded = Math.ceil( perpDist / latLngSeparation );
    
    var fullspan = sub(uxly,lxly);
    var rowEnds = [];
    for (var i = 0; i < rowsNeeded; i++) {
        var start = add(lxly, scale(perpVec,i*latLngSeparation));
        var end = add(lxuy, scale(perpVec,i*latLngSeparation));
        rowEnds.push( {start:start,end:end} );
    }

    for (var i = 0; i < rowEnds.length; i++) {
        var row = rowEnds[i];
        var closestHit, furthestHit, closestDist = 99999999, furthestDist = -99999999;
        for (var k = 0; k < points.length; k++) {
            var pt0 = points[k];
            var pt1 = points[(k+1)%points.length];
            var intersection = linesCross(row.start, row.end, pt0, pt1);
            if ( ! intersection ) 
                continue;
            if ( intersection.frac < closestDist ) {
                closestDist = intersection.frac;
                closestHit = intersection.point;
            }
            if ( intersection.frac > furthestDist ) {
                furthestDist = intersection.frac;
                furthestHit = intersection.point;
            }
        }
        row.start = closestHit;
        row.end = furthestHit;
        if ( i%2 == 1 ) {
            // swap start and end for every second row
            var tmp = row.start.x;
            row.start.x = row.end.x;
            row.end.x = tmp;
            tmp = row.start.y;
            row.start.y = row.end.y;
            row.end.y = tmp;
        }
    }
    
    return rowEnds;
}

