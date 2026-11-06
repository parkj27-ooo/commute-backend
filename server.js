const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// 고정된 위치 정보 (삼성화재 본사 ↔ 디에이치방배 101동)
const LOCATIONS = {
  HOME: { 
    name: '디에이치방배 101동', 
    lat: 37.4851, 
    lng: 126.9904, 
    address: '서울특별시 서초구 서초대로 50' 
  },
  OFFICE: { 
    name: '삼성화재 본사 사옥', 
    lat: 37.4958,  
    lng: 127.0267, 
    address: '서울특별시 서초구 서초대로74길 14' 
  }
};

app.get('/api/commute-routes', async (req, res) => {
  const { direction = 'WORK_TO_HOME' } = req.query; 

  // 방향에 따른 출발지/도착지 설정
  const origin = direction === 'WORK_TO_HOME' ? LOCATIONS.OFFICE : LOCATIONS.HOME;
  const destination = direction === 'WORK_TO_HOME' ? LOCATIONS.HOME : LOCATIONS.OFFICE;

  const apiKey = process.env.ODSAY_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ success: false, message: "ODSAY_API_KEY가 설정되지 않았습니다." });
  }

  try {
    // 💡 오디세이 대중교통 경로검색 API 호출 (SX, SY: 출발지 경도,위도 / EX, EY: 도착지 경도,위도)
    const odsayUrl = 'https://api.odsay.com/v1/api/searchPubTransPathT';
    const response = await axios.get(odsayUrl, {
      params: {
        apiKey: apiKey,
        SX: origin.lng,
        SY: origin.lat,
        EX: destination.lng,
        EY: destination.lat,
        OPT: 0
      }
    });

    // 응답 데이터 구조 확인용 로그
    console.log("ODsay API 응답 상태:", response.status);

    // 오디세이 API가 정상적인 경로 데이터를 반환했는지 검증
    const pathData = response.data && response.data.result && response.data.result.path;

    if (!pathData || !Array.isArray(pathData) || pathData.length === 0) {
      console.log("⚠️ 오디세이에서 검색된 경로가 없습니다. 응답 데이터:", JSON.stringify(response.data));
      return res.status(404).json({ success: false, message: "실시간 대중교통 경로를 찾지 못했습니다." });
    }

    // 상위 3개 실시간 경로 추출 및 프론트엔드 맞춤형 포맷으로 가공
    const topPaths = pathData.slice(0, 3);
    const routes = topPaths.map((item, index) => {
      // 경로 타입 판별 (1: 지하철, 2: 버스, 3: 지하철+버스 등)
      let title = "대중교통 최적 경로";
      if (item.pathType === 1) title = "지하철 중심 실시간 경로";
      else if (item.pathType === 2) title = "버스 중심 실시간 경로";
      else if (item.pathType === 3) title = "지하철 + 버스 환승 경로";

      return {
        rank: index + 1,
        title: title,
        totalTime: item.info.totalTime, // 총 소요 시간 (분)
        transitCount: (item.info.busTransitCount || 0) + (item.info.subwayTransitCount || 0) - 1,
        subPaths: item.subPath.map(sp => {
          let type = '도보';
          if (sp.trafficType === 1) type = '지하철';
          else if (sp.trafficType === 2) type = '버스';

          // 노선 이름 추출 (예: 2호선, 4319번 등)
          let laneName = '';
          if (sp.lane && sp.lane.length > 0) {
            laneName = sp.lane[0].name || sp.lane[0].busNo || '';
          }

          return {
            type: type,
            lane: laneName,
            sectionTime: sp.sectionTime,
            startName: sp.startName || '출발지',
            endName: sp.endName || '도착지'
          };
        })
      };
    });

    // 최종 실시간 데이터를 프론트엔드로 반환
    res.json({
      success: true,
      direction,
      updatedAt: new Date().toISOString(),
      origin,
      destination,
      routes
    });

  } catch (error) {
    console.error('ODsay API 호출 중 에러 발생:', error.message);
    res.status(500).json({ success: false, message: "서버 내부 통신 에러가 발생했습니다." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});