import mqtt from "mqtt";
import { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
  Dimensions,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";

const MQTT_SERVER = "ws://hackathon.blankit.dpdns.org/websocket:1883";
const MQTT_USERNAME = "IDIOTuser";
const MQTT_PASSWORD = "iDiOtPaSsWoRd@";
const SENSOR_TOPIC = "sensors/IMUDevice";
const MAX_VALUES = 7;

export default function App() {
  const [sensorMeta, setSensorMeta] = useState({
    address: "",
    name: "",
    description: "",
  });
  const [latestAccel, setLatestAccel] = useState({ x: 0, y: 0, z: 0 });
  const [latestGyro, setLatestGyro] = useState({ x: 0, y: 0, z: 0 });
  const [accelArray, setAccelArray] = useState([]);
  const [gyroArray, setGyroArray] = useState([]);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const clientRef = useRef();

  // Update screen width on orientation change
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    const client = mqtt.connect(MQTT_SERVER, {
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
    });
    clientRef.current = client;

    clientRef.current.on("connect", () => {
      ToastAndroid.show("Connected to MQTT broker", ToastAndroid.SHORT);
      clientRef.current.subscribe(SENSOR_TOPIC, { qos: 0 });
    });

    clientRef.current.on("error", (error) => {
      ToastAndroid.show(
        `MQTT connect error: ${error?.message || error}`,
        ToastAndroid.LONG
      );
    });

    clientRef.current.on("message", (topic, message) => {
      if (topic === SENSOR_TOPIC) {
        try {
          const msg = JSON.parse(message.toString());
          setSensorMeta({
            address: msg.address || "",
            name: msg.name || "",
            description: msg.description || "",
          });

          const newAccel = {
            x: parseFloat(msg.data?.accel?.x) || 0,
            y: parseFloat(msg.data?.accel?.y) || 0,
            z: parseFloat(msg.data?.accel?.z) || 0,
          };
          const newGyro = {
            x: parseFloat(msg.data?.gyro?.x) || 0,
            y: parseFloat(msg.data?.gyro?.y) || 0,
            z: parseFloat(msg.data?.gyro?.z) || 0,
          };

          setAccelArray((prev) =>
            prev.length < MAX_VALUES
              ? [...prev, newAccel]
              : [...prev.slice(1), newAccel]
          );
          setGyroArray((prev) =>
            prev.length < MAX_VALUES
              ? [...prev, newGyro]
              : [...prev.slice(1), newGyro]
          );
          setSampleIndex((prev) => prev + 1);

          setLatestAccel(newAccel);
          setLatestGyro(newGyro);
        } catch (e) {
          // handle parse errors if needed
        }
      }
    });

    return () => {
      clientRef.current.end(true);
    };
  }, []);

  // Helper function to calculate min/max with padding
  const getMinMax = (dataArray) => {
    if (dataArray.length === 0) return { min: 0, max: 10 };
    
    const allValues = dataArray.flatMap(item => [item.x, item.y, item.z]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // Prevent flat line when all values are the same
    if (min === max) {
      return {
        min: min - 1,
        max: max + 1,
      };
    }
    
    // Add 20% padding to prevent clipping
    const range = max - min;
    const padding = range * 0.2;
    
    return {
      min: min - padding,
      max: max + padding,
    };
  };

  const accelMinMax = getMinMax(accelArray);
  const gyroMinMax = getMinMax(gyroArray);

  // Calculate available width accounting for Y-axis labels (~60px)
  const availableWidth = screenWidth - 80; // Total padding from container
  const yAxisWidth = 60; // Space taken by Y-axis
  const effectiveWidth = availableWidth - yAxisWidth;
  
  // Calculate proper spacing to show all points
  const dataPoints = Math.max(accelArray.length, 1);
  const pointSpacing = Math.max(40, Math.floor(effectiveWidth / (dataPoints + 1)));
  const chartWidth = (dataPoints * pointSpacing) + yAxisWidth + 40;

  // Prepare data for LineChart (3 lines: X, Y, Z)
  const accelDataX = accelArray.map((item, idx) => ({
    value: item.x,
    label: `${sampleIndex - accelArray.length + idx + 1}`,
  }));
  const accelDataY = accelArray.map((item, idx) => ({
    value: item.y,
  }));
  const accelDataZ = accelArray.map((item, idx) => ({
    value: item.z,
  }));

  const gyroDataX = gyroArray.map((item, idx) => ({
    value: item.x,
    label: `${sampleIndex - gyroArray.length + idx + 1}`,
  }));
  const gyroDataY = gyroArray.map((item, idx) => ({
    value: item.y,
  }));
  const gyroDataZ = gyroArray.map((item, idx) => ({
    value: item.z,
  }));

  return (
    <SafeAreaView style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor="#12161A" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>IMU MQTT Dashboard</Text>

        {/* Metadata Card */}
        <View style={styles.sensorCard}>
          <Text style={styles.sensorTitle}>Address</Text>
          <Text style={styles.sensorData}>{sensorMeta.address}</Text>
          <Text style={styles.sensorTitle}>Name</Text>
          <Text style={styles.sensorData}>{sensorMeta.name}</Text>
          <Text style={styles.sensorTitle}>Description</Text>
          <Text style={styles.sensorData}>{sensorMeta.description}</Text>
        </View>

        {/* Current Values Section */}
        <View style={styles.sensorsSection}>
          <View style={styles.sensorCard}>
            <Text style={styles.sensorTitle}>Accelerometer (Latest)</Text>
            <Text style={styles.sensorData}>
              X: {latestAccel.x.toFixed(2)} {"  "}
              Y: {latestAccel.y.toFixed(2)} {"  "}
              Z: {latestAccel.z.toFixed(2)}
            </Text>
          </View>
          <View style={styles.sensorCard}>
            <Text style={styles.sensorTitle}>Gyroscope (Latest)</Text>
            <Text style={styles.sensorData}>
              X: {latestGyro.x.toFixed(2)} {"  "}
              Y: {latestGyro.y.toFixed(2)} {"  "}
              Z: {latestGyro.z.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Accelerometer Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Accelerometer History (X, Y, Z)</Text>
          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#1de9b6" }]} />
              <Text style={styles.legendText}>X-axis</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#FF6B9D" }]} />
              <Text style={styles.legendText}>Y-axis</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#FFD700" }]} />
              <Text style={styles.legendText}>Z-axis</Text>
            </View>
          </View>
          {accelDataX.length > 0 ? (
            <View style={styles.chartContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={true}
                persistentScrollbar={true}
                style={styles.chartScroll}
              >
                <LineChart
                  data={accelDataX}
                  data2={accelDataY}
                  data3={accelDataZ}
                  width={chartWidth}
                  height={180}
                  spacing={pointSpacing}
                  initialSpacing={20}
                  endSpacing={20}
                  noOfSections={4}
                  maxValue={accelMinMax.max}
                  mostNegativeValue={accelMinMax.min}
                  yAxisOffset={accelMinMax.min}
                  color="#1de9b6"
                  color2="#FF6B9D"
                  color3="#FFD700"
                  thickness={2.5}
                  startFillColor="#1de9b6"
                  startFillColor2="#FF6B9D"
                  startFillColor3="#FFD700"
                  startOpacity={0.25}
                  startOpacity2={0.25}
                  startOpacity3={0.25}
                  endOpacity={0.05}
                  endOpacity2={0.05}
                  endOpacity3={0.05}
                  areaChart
                  curved
                  yAxisColor="#252C34"
                  xAxisColor="#252C34"
                  yAxisThickness={1}
                  xAxisThickness={1}
                  yAxisTextStyle={{ color: "#777", fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: "#777", fontSize: 9 }}
                  yAxisLabelWidth={55}
                  rulesColor="#252C34"
                  rulesType="solid"
                  isAnimated={false}
                  adjustToWidth={false}
                  disableScroll={true}
                />
              </ScrollView>
            </View>
          ) : (
            <Text style={styles.noDataText}>Waiting for data...</Text>
          )}
        </View>

        {/* Gyroscope Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Gyroscope History (X, Y, Z)</Text>
          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#1de9b6" }]} />
              <Text style={styles.legendText}>X-axis</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#FF6B9D" }]} />
              <Text style={styles.legendText}>Y-axis</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#FFD700" }]} />
              <Text style={styles.legendText}>Z-axis</Text>
            </View>
          </View>
          {gyroDataX.length > 0 ? (
            <View style={styles.chartContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={true}
                persistentScrollbar={true}
                style={styles.chartScroll}
              >
                <LineChart
                  data={gyroDataX}
                  data2={gyroDataY}
                  data3={gyroDataZ}
                  width={chartWidth}
                  height={180}
                  spacing={pointSpacing}
                  initialSpacing={20}
                  endSpacing={20}
                  noOfSections={4}
                  maxValue={gyroMinMax.max}
                  mostNegativeValue={gyroMinMax.min}
                  yAxisOffset={gyroMinMax.min}
                  color="#1de9b6"
                  color2="#FF6B9D"
                  color3="#FFD700"
                  thickness={2.5}
                  startFillColor="#1de9b6"
                  startFillColor2="#FF6B9D"
                  startFillColor3="#FFD700"
                  startOpacity={0.25}
                  startOpacity2={0.25}
                  startOpacity3={0.25}
                  endOpacity={0.05}
                  endOpacity2={0.05}
                  endOpacity3={0.05}
                  areaChart
                  curved
                  yAxisColor="#252C34"
                  xAxisColor="#252C34"
                  yAxisThickness={1}
                  xAxisThickness={1}
                  yAxisTextStyle={{ color: "#777", fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: "#777", fontSize: 9 }}
                  yAxisLabelWidth={55}
                  rulesColor="#252C34"
                  rulesType="solid"
                  isAnimated={false}
                  adjustToWidth={false}
                  disableScroll={true}
                />
              </ScrollView>
            </View>
          ) : (
            <Text style={styles.noDataText}>Waiting for data...</Text>
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
  chartCard: {
    backgroundColor: cardColor,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: borderColor,
    padding: 20,
    marginVertical: 15,
    width: "97%",
    maxWidth: 460,
    alignSelf: "center",
  },
  chartTitle: {
    color: accentColor,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    marginVertical: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  legendText: {
    color: "#AAA",
    fontSize: 12,
    fontWeight: "500",
  },
  chartContainer: {
    width: "100%",
    height: 200,
  },
  chartScroll: {
    width: "100%",
  },
  noDataText: {
    color: "#777",
    fontSize: 14,
    textAlign: "center",
    marginVertical: 20,
  },
});
