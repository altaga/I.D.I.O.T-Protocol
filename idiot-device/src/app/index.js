import {
  Accelerometer,
  DeviceMotion,
  Gyroscope,
  Magnetometer,
} from "expo-sensors";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, SafeAreaView, StatusBar, ToastAndroid } from "react-native";
import {fetch} from "expo/fetch"

// Device Info
const SENSOR_API_URL = "https://hackathon.blankit.dpdns.org/api/sensors";
const SENSOR_ADDRESS = "0x109ded5f81e7a65faf5ee05d48e0bab217639129";
const SENSOR_NAME = "Idiot Device";
const SENSOR_DESCRIPTION = "This is a personal idiot iot device";

// Helper for gravity estimation
function applyLowPassFilter(current, gravity, alpha = 0.8) {
  return {
    x: alpha * gravity.x + (1 - alpha) * current.x,
    y: alpha * gravity.y + (1 - alpha) * current.y,
    z: alpha * gravity.z + (1 - alpha) * current.z,
  };
}

export default function App() {
  // State only for display/UI
  const [accel, setAccel] = useState({ x: 0, y: 0, z: 0 });
  const [gravity, setGravity] = useState({ x: 0, y: 0, z: 0 });
  const [gyro, setGyro] = useState({ x: 0, y: 0, z: 0 });
  const [magnet, setMagnet] = useState({ x: 0, y: 0, z: 0 });
  const [motion, setMotion] = useState({
    accelerationIncludingGravity: { x: 0, y: 0, z: 0 },
    rotation: { alpha: 0, beta: 0, gamma: 0 },
  });

  const [available, setAvailable] = useState({
    accel: false,
    gyro: false,
    magnet: false,
    motion: false,
  });

  // Refs for up-to-date sensor values
  const accelRef = useRef({ x: 0, y: 0, z: 0 });
  const gravityRef = useRef({ x: 0, y: 0, z: 0 });
  const gyroRef = useRef({ x: 0, y: 0, z: 0 });
  const magnetRef = useRef({ x: 0, y: 0, z: 0 });
  const motionRef = useRef({
    accelerationIncludingGravity: { x: 0, y: 0, z: 0 },
    rotation: { alpha: 0, beta: 0, gamma: 0 },
  });

  // Sensor availability check
  useEffect(() => {
    (async () => {
      const [accelAvail, gyroAvail, magnetAvail, motionAvail] =
        await Promise.all([
          Accelerometer.isAvailableAsync(),
          Gyroscope.isAvailableAsync(),
          Magnetometer.isAvailableAsync(),
          DeviceMotion.isAvailableAsync(),
        ]);
      setAvailable({
        accel: accelAvail,
        gyro: gyroAvail,
        magnet: magnetAvail,
        motion: motionAvail,
      });
    })();
  }, []);

  // Sensor listeners: update both state (for UI) and ref (for sending)
  useEffect(() => {
    let gravityCurrent = { x: 0, y: 0, z: 0 };
    let accelSub, gyroSub, magnetSub, motionSub;

    if (available.accel) {
      accelSub = Accelerometer.addListener((accelData) => {
        const myAccelData = { x: accelData.x || 0, y: accelData.y || 0, z: accelData.z || 0 };
        setAccel(myAccelData);
        accelRef.current = myAccelData;
        gravityCurrent = applyLowPassFilter(accelData, gravityCurrent, 0.8);
        setGravity(gravityCurrent);
        gravityRef.current = gravityCurrent;
      });
      Accelerometer.setUpdateInterval(500);
    }
    if (available.gyro) {
      gyroSub = Gyroscope.addListener((gyroData) => {
        const val = {
          x: gyroData.x || 0,
          y: gyroData.y || 0,
          z: gyroData.z || 0,
        };
        setGyro(val);
        gyroRef.current = val;
      });
      Gyroscope.setUpdateInterval(500);
    }
    if (available.magnet) {
      magnetSub = Magnetometer.addListener((magnetData) => {
        const val = {
          x: magnetData.x || 0,
          y: magnetData.y || 0,
          z: magnetData.z || 0,
        }
        setMagnet(val);
        magnetRef.current = val;
      });
      Magnetometer.setUpdateInterval(500);
    }
    if (available.motion) {
      motionSub = DeviceMotion.addListener((data) => {
        const acc = {
          x: data.accelerationIncludingGravity?.x || 0,
          y: data.accelerationIncludingGravity?.y || 0,
          z: data.accelerationIncludingGravity?.z || 0,
        }
        const rot = {
          alpha: data.rotation?.alpha || 0,
          beta: data.rotation?.beta || 0,
          gamma: data.rotation?.gamma || 0,
        }
        setMotion({
          accelerationIncludingGravity: acc,
          rotation: rot
        });
        motionRef.current = {
          accelerationIncludingGravity: acc,
          rotation: rot
        };
      });
      DeviceMotion.setUpdateInterval(500);
    }

    return () => {
      accelSub && accelSub.remove();
      gyroSub && gyroSub.remove();
      magnetSub && magnetSub.remove();
      motionSub && motionSub.remove();
    };
  }, [available]);

  // sendSensorData always pulls latest from refs!
  const sendSensorData = useCallback(() => {
    const sensorData = {
      accel: available.accel ? accelRef.current : null,
      gravity: available.accel ? gravityRef.current : null,
      gyro: available.gyro ? gyroRef.current : null,
      magnet: available.magnet ? magnetRef.current : null,
      deviceMotion: available.motion
        ? {
            gravity: motionRef.current.accelerationIncludingGravity,
            rotation: motionRef.current.rotation,
          }
        : null,
    };

    console.log("Sensor data to send:", sensorData);

    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
      address: SENSOR_ADDRESS,
      name: SENSOR_NAME,
      description: SENSOR_DESCRIPTION,
      data: sensorData,
      timestamp: Date.now(),
    });

    fetch(SENSOR_API_URL, {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    })
      .then((response) => response.text())
      .then((result) => console.log("Sensor sent:", result))
      .catch((error) => ToastAndroid.show(JSON.stringify(error), ToastAndroid.SHORT));
  }, [available]);

  // Call on mount and every 10s
  useEffect(() => {
    sendSensorData();
    const interval = setInterval(() => {
      sendSensorData();
    }, 10000);
    return () => clearInterval(interval);
  }, [sendSensorData]);

  return (
    <SafeAreaView style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor="#12161A" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Mobile I.D.I.O.T Device</Text>

        <View style={styles.sensorCard}>
          <Text style={styles.sensorTitle}>Address</Text>
          <Text style={styles.sensorData}>{SENSOR_ADDRESS}</Text>
          <Text style={styles.sensorTitle}>Name</Text>
          <Text style={styles.sensorData}>{SENSOR_NAME}</Text>
          <Text style={styles.sensorTitle}>Description</Text>
          <Text style={styles.sensorData}>{SENSOR_DESCRIPTION}</Text>
        </View>

        <View style={styles.sensorsSection}>
          {available.accel && (
            <View style={styles.sensorCard}>
              <Text style={styles.sensorTitle}>Accelerometer</Text>
              <Text style={styles.sensorData}>
                X: {accel.x.toFixed(3)}  {"  "}Y: {accel.y.toFixed(3)}  {"  "}Z: {accel.z.toFixed(3)}
              </Text>
              <Text style={styles.sensorTitle}>Estimated Gravity (Low-Pass)</Text>
              <Text style={styles.sensorData}>
                X: {gravity.x.toFixed(3)}  {"  "}Y: {gravity.y.toFixed(3)}  {"  "}Z: {gravity.z.toFixed(3)}
              </Text>
            </View>
          )}
          {available.gyro && (
            <View style={styles.sensorCard}>
              <Text style={styles.sensorTitle}>Gyroscope</Text>
              <Text style={styles.sensorData}>
                X: {gyro.x.toFixed(3)}  {"  "}Y: {gyro.y.toFixed(3)}  {"  "}Z: {gyro.z.toFixed(3)}
              </Text>
            </View>
          )}
          {available.magnet && (
            <View style={styles.sensorCard}>
              <Text style={styles.sensorTitle}>Magnetometer</Text>
              <Text style={styles.sensorData}>
                X: {magnet.x.toFixed(3)}  {"  "}Y: {magnet.y.toFixed(3)}  {"  "}Z: {magnet.z.toFixed(3)}
              </Text>
            </View>
          )}
          {available.motion && (
            <View style={styles.sensorCard}>
              <Text style={styles.sensorTitle}>Device Motion (Gravity)</Text>
              <Text style={styles.sensorData}>
                X: {motion.accelerationIncludingGravity.x.toFixed(3)}  {"  "}
                Y: {motion.accelerationIncludingGravity.y.toFixed(3)}  {"  "}
                Z: {motion.accelerationIncludingGravity.z.toFixed(3)}
              </Text>
              <Text style={styles.sensorTitle}>Device Orientation</Text>
              <Text style={styles.sensorData}>
                Alpha: {motion.rotation.alpha?.toFixed(3) || "0"}  {"  "}
                Beta: {motion.rotation.beta?.toFixed(3) || "0"}  {"  "}
                Gamma: {motion.rotation.gamma?.toFixed(3) || "0"}
              </Text>
            </View>
          )}
          {Object.values(available).every((v) => !v) && (
            <View style={styles.sensorCardAlert}>
              <Text style={styles.noSensorsText}>No supported sensors found on this device.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const cardColor = "#181F26";
const accentColor = "#1de9b6";
const borderColor = "#252C34";

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#12161A",
  },
  container: {
    flexGrow: 1,
    backgroundColor: "#12161A",
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 8,
    minHeight: "100%",
    justifyContent: "space-around",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 2,
    marginVertical: 25,
    color: accentColor,
    textAlign: "center",
    textShadowColor: "#000C",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 12,
    width: "100%",
  },
  sensorsSection: {
    width: "100%",
    flexGrow: 1,
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 10,
  },
  sensorCard: {
    backgroundColor: cardColor,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: borderColor,
    padding: 20,
    marginVertical: 10,
    width: "97%",
    maxWidth: 460,
    shadowColor: accentColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    alignSelf: "center",
  },
  sensorTitle: {
    color: accentColor,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 5,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sensorData: {
    fontSize: 17,
    color: "#FFF",
    fontWeight: "500",
    marginBottom: 8,
    letterSpacing: 1,
  },
  sensorCardAlert: {
    backgroundColor: "#B71C1C",
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    alignItems: "center",
    width: "97%",
    maxWidth: 410,
    alignSelf: "center",
  },
  noSensorsText: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "600",
  },
});
