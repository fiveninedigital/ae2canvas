﻿function getProperty(data, split) {
    if (!data instanceof Property) return null;

    if (data.numKeys < 1) {
        return getStaticProperty(data, split);
    } else {
        return getAnimatedProperty(data, split);
    }
}

function getStaticProperty(data, split) {

    var arr = [];

    if (data.value instanceof Array && typeof split === 'number') {
        arr.push({
            t: 0,
            v: data.value[split]
        });
    } else {
        arr.push({
            t: 0,
            v: data.value
        });
    }

    return arr;
}

function getAnimatedProperty(data, split) {
    return normalizeKeyframes(getKeyframes(data, split));
}

function getKeyframes(data, split) {

    var arr = [],
        numKeys = data.numKeys;

    for (var i = 1; i <= numKeys; i++) {

        var obj = {},
            inType,
            outType,
            easeIn,
            easeOut;

        obj.t = data.keyTime(i) * 1000;

        inType = data.keyInInterpolationType(i);
        outType = data.keyOutInterpolationType(i);

        if (typeof split === 'number' && data.keyInTemporalEase(i)[split] && data.keyOutTemporalEase(i)[split]) {
            easeIn = data.keyInTemporalEase(i)[split];
            easeOut = data.keyOutTemporalEase(i)[split];
        } else {
            //anchor needs split, but has no second keyframeobject
            easeIn = data.keyInTemporalEase(i)[0];
            easeOut = data.keyOutTemporalEase(i)[0];
        }

        if (typeof split === 'number') {
            obj.v = data.keyValue(i)[split || 0];
        } else {
            obj.v = data.keyValue(i);
        }

        if (i > 1 && inType !== KeyframeInterpolationType.HOLD) {
            obj.easeIn = [];
            obj.easeIn[0] = easeIn.influence;
            obj.easeIn[1] = easeIn.speed;
        }

        if (i < numKeys && outType !== KeyframeInterpolationType.HOLD) {
            obj.easeOut = [];
            obj.easeOut[0] = easeOut.influence;
            obj.easeOut[1] = easeOut.speed;
        }

        //position with motionpath
        if (data.matchName === 'ADBE Position' && !data.dimensionsSeparated &&
            (data.propertyValueType === PropertyValueType.TwoD_SPATIAL || data.propertyValueType === PropertyValueType.ThreeD_SPATIAL)) {
            if (i > 1) {
                obj.inTangent = data.keyInSpatialTangent(i);
                obj.easeIn = [];
                obj.easeIn[0] = easeIn.influence;
                obj.easeIn[1] = easeIn.speed;
            }

            if (i < numKeys) {
                obj.outTangent = data.keyOutSpatialTangent(i);
                obj.easeOut = [];
                obj.easeOut[0] = easeOut.influence;
                obj.easeOut[1] = easeOut.speed;
            }
        }

        arr.push(obj);
    }

    return arr;
}

function normalizeKeyframes(frames) {

    for (var i = 1; i < frames.length; i++) {

        var lastKey = frames[i - 1],
            key = frames[i],
            duration = key.t - lastKey.t,
            diff,
            easeOut, easeIn,
            normInfluenceIn, normSpeedIn,
            normInfluenceOut, normSpeedOut,
            x, y, z,
            ratio;

        // multidimensional properties, fill array has 4 fields. dont need last one
        if (key.v instanceof Array && key.v.length > 2) {
            x = key.v[0] - lastKey.v[0];
            y = key.v[1] - lastKey.v[1];
            z = key.v[1] - lastKey.v[2];
            diff = Math.pow(x * x + y * y + z * z, 1 / 3);
        } else if (key.v instanceof Array && key.v.length === 2) {
            x = key.v[0] - lastKey.v[0];
            y = key.v[1] - lastKey.v[1];
            diff = Math.sqrt(x * x + y * y);
        } else {
            diff = key.v - lastKey.v;
        }

        //FIXME hackiest shit ever :)
        // fix problem if lastKey.v === key.v, but has easing
        //TODO use modulo
        if (diff < 0.01 && diff > -0.01) {
            diff = 0.01;
            if (key.v instanceof Array) {
                for (var j = 0; j < key.v.length; j++) {
                    key.v[j] = lastKey.v[j] + 0.01;
                }
            } else {
                key.v = lastKey.v + 0.01;
            }
        }

        var averageTempo = diff / duration * 1000;

        if (key.easeIn) {
            normInfluenceIn = key.easeIn[0] / 100;
            normSpeedIn = key.easeIn[1] / averageTempo * normInfluenceIn;
            easeIn = [];
            //position
//            if (key.inTangent) {
//                ratio = key.inTangent / diff;
//                easeIn[0] = 0.05;
//                easeIn[1] = 1 + ratio;
////                delete  key.inTangent;
////                delete  key.outTangent;
//            } else {
//            }
            easeIn[0] = Math.round((1 - normInfluenceIn) * 1000) / 1000;
            easeIn[1] = Math.round((1 - normSpeedIn) * 1000) / 1000;
//            key.oldEaseIn = [key.easeIn[0], key.easeIn[1]];
            key.easeIn = easeIn;
        }

        if (lastKey.easeOut) {
            normInfluenceOut = lastKey.easeOut[0] / 100;
            normSpeedOut = lastKey.easeOut[1] / averageTempo * normInfluenceOut;
            easeOut = [];

            //position
//            if (lastKey.outTangent) {
//                ratio = lastKey.outTangent / diff;
//                easeOut[0] = 0.05;
//                easeOut[1] = ratio;
////                delete lastKey.inTangent;
////                delete lastKey.outTangent;
//            } else {
//            }
            easeOut[0] = Math.round(normInfluenceOut * 1000) / 1000;
            easeOut[1] = Math.round(normSpeedOut * 1000) / 1000;
//            lastKey.oldEaseOut = [lastKey.easeOut[0], lastKey.easeOut[1]];
            lastKey.easeOut = easeOut;
        }

        //set default values
        if (lastKey.easeOut && !key.easeIn) {
            key.easeIn = [0.16667, 1];
        } else if (key.easeIn && !lastKey.easeOut) {
            lastKey.easeOut = [0.16667, 0];
        }
    }

    return frames;
}