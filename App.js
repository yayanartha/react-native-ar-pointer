import React, {useEffect, useState, useMemo, useRef, useCallback} from 'react';
import {StyleSheet, Platform} from 'react-native';
import {
  ViroNode,
  ViroFlexView,
  ViroARScene,
  ViroText,
  ViroQuad,
  ViroBox,
  ViroTrackingStateConstants,
  ViroARSceneNavigator,
} from '@viro-community/react-viro';
import CompassHeading from 'react-native-compass-heading';
import Geolocation from '@react-native-community/geolocation';
import haversine from 'haversine';
import {requestMultiple, PERMISSIONS, RESULTS} from 'react-native-permissions';

const qiblaPosition = {
  latitude: 21.4224779,
  longitude: 39.8251832,
};

const latLongToMerc = (latDeg, longDeg) => {
  // From: https://gist.github.com/scaraveos/5409402
  const longRad = (longDeg / 180.0) * Math.PI;
  const latRad = (latDeg / 180.0) * Math.PI;
  const smA = 6378137.0;
  const xmeters = smA * longRad;
  const ymeters = smA * Math.log((Math.sin(latRad) + 1) / Math.cos(latRad));

  return {x: xmeters, y: ymeters};
};

const HelloWorldSceneAR = () => {
  const [text, setText] = useState('Initializing AR...');
  const [currentPosition, setCurrentPosition] = useState();
  const [cameraPermission, setCameraPermission] = useState();
  const [locationPermission, setLocationPermission] = useState();
  const [compassHeading, setCompassHeading] = useState(0);
  const locationRef = useRef();

  function onInitialized(state, reason) {
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      setText('Hello World!');
    } else if (state === ViroTrackingStateConstants.TRACKING_NONE) {
      // Handle loss of tracking
    }
  }

  const distance = useMemo(() => {
    if (!currentPosition) {
      return 0;
    }

    return haversine(currentPosition, qiblaPosition);
  }, [currentPosition]);

  useEffect(() => {
    // Permission.
    const permissions = Platform.select({
      ios: [PERMISSIONS.IOS.CAMERA, PERMISSIONS.IOS.LOCATION_WHEN_IN_USE],
      android: [
        PERMISSIONS.ANDROID.CAMERA,
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      ],
    });

    requestMultiple(permissions).then(statuses => {
      if (Platform.OS == 'ios') {
        setLocationPermission(
          statuses[PERMISSIONS.IOS.LOCATION_WHEN_IN_USE] === RESULTS.GRANTED,
        );
        setCameraPermission(
          statuses[PERMISSIONS.IOS.CAMERA] === RESULTS.GRANTED,
        );
      } else {
        setLocationPermission(
          statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] ===
            RESULTS.GRANTED,
        );
        setCameraPermission(
          statuses[PERMISSIONS.ANDROID.CAMERA] === RESULTS.GRANTED,
        );
      }
    });

    // Compass.
    CompassHeading.start(3, ({heading}) => {
      setCompassHeading(heading);
    });

    return () => {
      CompassHeading.stop();
    };
  }, []);

  useEffect(() => {
    if (locationPermission) {
      Geolocation.watchPosition(
        data => {
          setCurrentPosition({
            latitude: data.coords.latitude,
            longitude: data.coords.longitude,
          });
        },
        error => {},
        {distanceFilter: 10},
      );
    }

    return () => {
      if (locationRef.current) {
        Geolocation.clearWatch(locationRef.current);
      }
    };
  }, [locationPermission]);

  const arCoords = useMemo(() => {
    if (!currentPosition) {
      return {x: 0, z: 0};
    }

    const deviceObjPoint = latLongToMerc(
      qiblaPosition.latitude,
      qiblaPosition.longitude,
    );
    const mobilePoint = latLongToMerc(
      currentPosition.latitude,
      currentPosition.longitude,
    );
    const objDeltaY = deviceObjPoint.y - mobilePoint.y;
    const objDeltaX = deviceObjPoint.x - mobilePoint.x;

    if (Platform.OS === 'android') {
      let angleRadian = (0 * Math.PI) / 180;
      let newObjX =
        objDeltaX * Math.cos(angleRadian) - objDeltaY * Math.sin(angleRadian);
      let newObjY =
        objDeltaX * Math.sin(angleRadian) + objDeltaY * Math.cos(angleRadian);

      return {x: newObjX, z: -newObjY};
    }

    return {x: objDeltaX, z: -objDeltaY};
  }, [currentPosition]);

  const scale = useMemo(() => {
    return Math.abs(Math.round(arCoords.z / 2));
  }, [arCoords]);

  const placeArObject = useCallback(
    () => (
      <ViroNode
        scale={[scale, scale, scale]}
        rotation={[0, 0, 0]}
        position={[arCoords.x, 0, arCoords.z]}>
        <ViroFlexView
          style={{alignItems: 'center', justifyContent: 'center'}}
          transformBehaviors={['billboard']}>
          <ViroText
            width={4}
            height={0.5}
            text="Qibla"
            style={styles.textStyle}
          />
          <ViroText
            width={4}
            height={0.5}
            text={`${Math.round(distance)} km`}
            style={styles.textStyle}
            position={[0, -0.75, 0]}
          />
          <ViroQuad width={1} height={1} position={[0, 0, 30]} />
        </ViroFlexView>
      </ViroNode>
    ),
    [arCoords, distance],
  );

  return (
    <ViroARScene onTrackingUpdated={onInitialized}>
      {currentPosition && placeArObject()}

      {/* <ViroText
        text={`${Math.round(distance)}`}
        scale={[0.5, 0.5, 0.5]}
        position={[0, 0, -1]}
        style={styles.helloWorldTextStyle}
      /> */}
    </ViroARScene>
  );
};

export default () => {
  return (
    <ViroARSceneNavigator
      autofocus={true}
      initialScene={{
        scene: HelloWorldSceneAR,
      }}
      style={styles.f1}
    />
  );
};

var styles = StyleSheet.create({
  f1: {flex: 1},
  textStyle: {
    fontFamily: 'Arial',
    fontSize: 30,
    color: '#ffffff',
    textAlignVertical: 'center',
    textAlign: 'center',
  },
});
