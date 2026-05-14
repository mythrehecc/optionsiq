"use client";
import React, { useEffect, useState } from "react";
import Card from "antd/lib/card";
import Row from "antd/lib/row";
import Col from "antd/lib/col";
import Typography from "antd/lib/typography";
import Spin from "antd/lib/spin";
import Select from "antd/lib/select";
import Button from "antd/lib/button";
import Tag from "antd/lib/tag";
import Divider from "antd/lib/divider";
import Empty from "antd/lib/empty";
import Alert from "antd/lib/alert";
import LineChartOutlined from "@ant-design/icons/LineChartOutlined";
import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import WarningOutlined from "@ant-design/icons/WarningOutlined";
import CloseCircleOutlined from "@ant-design/icons/CloseCircleOutlined";
import RobotOutlined from "@ant-design/icons/RobotOutlined";
import AreaChartOutlined from "@ant-design/icons/AreaChartOutlined";
import DatabaseOutlined from "@ant-design/icons/DatabaseOutlined";
import { predictionsApi } from "@/services/api";

const { Title, Text } = Typography;
const { Option } = Select;

const cardStyle = {
  background: "linear-gradient(135deg, rgba(26,26,46,0.9), rgba(22,33,62,0.9))",
  border: "1px solid rgba(99,102,241,0.15)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
};

interface ModelInfo {
  stats: {
    cnn_accuracy: number;
    lstm_accuracy: number;
    train_period: string;
    test_period: string;
    tickers_trained: number;
  };
  cnn_available: boolean;
  lstm_available: boolean;
}

interface PredictionResult {
  ticker: string;
  cnn: {
    prediction: number;
    prediction_text: string;
    confidence: number;
    model_accuracy: number;
  };
  lstm: {
    prediction: number;
    prediction_text: string;
    confidence: number;
    model_accuracy: number;
  };
  chart_image: string;
  window_days: number;
  data_points: number;
}

export default function PredictionsPage() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    predictionsApi.tickers().then(res => {
      setTickers(res.data.tickers || []);
      if (res.data.tickers?.length > 0) setSelectedTicker(res.data.tickers[0]);
    }).catch(() => {});
    
    predictionsApi.modelInfo().then(res => {
      setModelInfo(res.data);
    }).catch(() => {});
  }, []);

  const handlePredict = async () => {
    if (!selectedTicker) return;
    setLoading(true);
    setError(null);
    try {
      const res = await predictionsApi.predict(selectedTicker);
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to generate prediction");
    } finally {
      setLoading(false);
    }
  };

  const renderPredictionBadge = (prediction: number, text: string) => {
    if (prediction === 1) return <Tag color="success" icon={<CheckCircleOutlined />}>Rise 📈</Tag>;
    if (prediction === -1) return <Tag color="error" icon={<CloseCircleOutlined />}>Fall 📉</Tag>;
    return <Tag color="warning" icon={<WarningOutlined />}>Neutral ➡️</Tag>;
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: "#fff", margin: 0, fontWeight: 800 }}>
          <RobotOutlined style={{ marginRight: 8, color: "#a5b4fc" }} />
          AI Stock Prediction
        </Title>
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
          Dual-model inference using CNN and LSTM neural networks on 20-day technical windows
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column - Controls & Info */}
        <Col xs={24} lg={8}>
          <Card style={cardStyle} bodyStyle={{ padding: 24 }}>
            <Title level={5} style={{ color: "#fff", marginTop: 0, marginBottom: 16 }}>Generate Prediction</Title>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, display: "block", marginBottom: 8 }}>SELECT TICKER</Text>
                <Select
                  showSearch
                  value={selectedTicker}
                  onChange={setSelectedTicker}
                  style={{ width: "100%" }}
                  size="large"
                  placeholder="Choose a stock symbol"
                  optionFilterProp="children"
                >
                  {tickers.map(t => <Option key={t} value={t}>{t}</Option>)}
                </Select>
              </div>

              <Button
                type="primary"
                size="large"
                icon={<LineChartOutlined />}
                onClick={handlePredict}
                loading={loading}
                disabled={!selectedTicker}
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  border: "none",
                  fontWeight: 600,
                  boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
                }}
              >
                Analyze & Predict
              </Button>
            </div>

            <Divider style={{ borderColor: "rgba(255,255,255,0.1)", margin: "24px 0" }} />

            {modelInfo && (
              <div>
                <Title level={5} style={{ color: "#fff", marginTop: 0, marginBottom: 16 }}>
                  <DatabaseOutlined style={{ marginRight: 8 }} />
                  Model Information
                </Title>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>CNN Accuracy:</Text>
                    <Tag color="purple">{modelInfo.stats.cnn_accuracy}%</Tag>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>LSTM Accuracy:</Text>
                    <Tag color="cyan">{modelInfo.stats.lstm_accuracy}%</Tag>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Training Universe:</Text>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{modelInfo.stats.tickers_trained} Tickers</Text>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Training Period:</Text>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{modelInfo.stats.train_period}</Text>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Validation Period:</Text>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{modelInfo.stats.test_period}</Text>
                  </div>
                </div>

                {!modelInfo.cnn_available && !modelInfo.lstm_available && (
                  <Alert
                    message="Models Not Loaded"
                    description="Using fallback rule-based predictions. Run the Jupyter notebook to train and save the ML models."
                    type="warning"
                    showIcon
                    style={{ marginTop: 16, background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", color: "rgba(255,255,255,0.8)" }}
                  />
                )}
              </div>
            )}
          </Card>
        </Col>

        {/* Right Column - Results */}
        <Col xs={24} lg={16}>
          <Card style={{ ...cardStyle, minHeight: "100%" }} bodyStyle={{ padding: 24, height: "100%" }}>
            {error && <Alert message="Error" description={error} type="error" showIcon style={{ marginBottom: 20 }} />}
            
            {!result && !loading && !error && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300 }}>
                <AreaChartOutlined style={{ fontSize: 64, color: "rgba(99,102,241,0.2)", marginBottom: 16 }} />
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>Select a ticker to generate AI predictions</Text>
              </div>
            )}

            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300 }}>
                <Spin size="large" />
                <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 16 }}>Analyzing market data and running inference...</Text>
              </div>
            )}

            {result && !loading && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <Title level={4} style={{ color: "#fff", margin: 0 }}>
                    Prediction Results for <span style={{ color: "#a5b4fc" }}>{result.ticker}</span>
                  </Title>
                  <Tag color="default" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {result.window_days}-Day Window
                  </Tag>
                </div>

                <Row gutter={[24, 24]}>
                  {/* Models Comparison */}
                  <Col xs={24} md={12}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      
                      {/* CNN Result */}
                      <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <Text style={{ color: "#fff", fontWeight: 700 }}>CNN (Chart Images)</Text>
                          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Acc: {result.cnn.model_accuracy}%</Text>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, display: "block", marginBottom: 4 }}>PREDICTION</Text>
                            {renderPredictionBadge(result.cnn.prediction, result.cnn.prediction_text)}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, display: "block", marginBottom: 4 }}>CONFIDENCE</Text>
                            <Text style={{ color: "#22d3ee", fontWeight: 700, fontSize: 18 }}>{result.cnn.confidence}%</Text>
                          </div>
                        </div>
                      </div>

                      {/* LSTM Result */}
                      <div style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 12, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <Text style={{ color: "#fff", fontWeight: 700 }}>LSTM (Price Sequences)</Text>
                          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Acc: {result.lstm.model_accuracy}%</Text>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, display: "block", marginBottom: 4 }}>PREDICTION</Text>
                            {renderPredictionBadge(result.lstm.prediction, result.lstm.prediction_text)}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, display: "block", marginBottom: 4 }}>CONFIDENCE</Text>
                            <Text style={{ color: "#22d3ee", fontWeight: 700, fontSize: 18 }}>{result.lstm.confidence}%</Text>
                          </div>
                        </div>
                      </div>

                    </div>
                  </Col>

                  {/* Chart Image */}
                  <Col xs={24} md={12}>
                    <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, height: "100%", display: "flex", flexDirection: "column" }}>
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 12, display: "block", fontWeight: 500 }}>
                        Analyzed Pattern (Last {result.window_days} Days)
                      </Text>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 8 }}>
                        <img 
                          src={`data:image/png;base64,${result.chart_image}`} 
                          alt={`${result.ticker} Chart`}
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                        />
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
