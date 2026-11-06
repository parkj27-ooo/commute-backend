const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 정확한 주소 및 고정 좌표 설정
const LOCATIONS = {
  HOME: { name: '디에이치방배 101동', lat: 37.4851, lng: 126.9904, address: '서울특별시 서초구 서초대로 50' },
  OFFICE: { name: '삼성화재 본사 사옥', lat: 37.4958, lng: 127.0267, address: '서울특별시 서초구 서초대로74길 14' }
};

// 실시간 대중교통 경로 조회 API 엔드포인트
app.get('/api/commute-routes', async (req, res) => {
  const { direction = 'WORK_TO_HOME' } = req.query; // WORK_TO_HOME (퇴근) 또는 HOME_TO_WORK (출근)

  const origin = direction === 'WORK_TO_HOME' ? LOCATIONS.OFFICE : LOCATIONS.HOME;
  const destination = direction === 'WORK_TO_HOME' ? LOCATIONS.HOME : LOCATIONS.OFFICE;

  try {
    // ODsay 대중교통 API 호출 (키가 없다면 아래 기본 예시 데이터로 대체 반환됩니다)
    const apiKey = process.env.ODSAY_API_KEY;
    
    if (!apiKey || apiKey === 'your_odsay_api_key_here') {
      // API 키가 설정되지 않은 경우 시뮬레이션 데이터 반환
      return res.json({
        success: true,
        direction,
        updatedAt: new Date().toISOString(),
        origin,
        destination,
        routes: [
          {
            rank: 1,
            title: "지하철 최단 경로 (2호선 ➔ 4호선 환승)",
            totalTime: 28, // 분
            transitCount: 1, // 환승 횟수
            subPaths: [
              { type: "도보", sectionTime: 6, startName: "삼성화재 본사", endName: "강남역" },
              { type: "지하철", lane: "2호선", sectionTime: 12, startName: "강남역", endName: "사당역" },
              { type: "지하철", lane: "4호선", sectionTime: 4, startName: "사당역", endName: "총신대입구(이수)역" },
              { type: "도보", sectionTime: 6, startName: "이수역 2번 출구", endName: "디에이치방배 101동" }
            ]
          },
          {
            rank: 2,
            title: "지하철 2호선 직행 + 도보/마을버스",
            totalTime: 33,
            transitCount: 0,
            subPaths: [
              { type: "도보", sectionTime: 6, startName: "삼성화재 본사", endName: "강남역" },
              { type: "지하철", lane: "2호선", sectionTime: 7, startName: "강남역", endName: "방배역" },
              { type: "도보", sectionTime: 20, startName: "방배역 3번 출구", endName: "디에이치방배 101동" }
            ]
          },
          {
            rank: 3,
            title: "지선버스 직행 (4319번)",
            totalTime: 38,
            transitCount: 0,
            subPaths: [
              { type: "도보", sectionTime: 7, startName: "삼성화재 본사", endName: "강남역 정류장" },
              { type: "버스", lane: "지선 4319", sectionTime: 24, startName: "강남역", endName: "방배고개" },
              { type: "도보", sectionTime: 7, startName: "방배고개", endName: "디에이치방배 101동" }
            ]
          }
        ]
      });
    }

    // 실제 ODsay API 연동 코드
    const response = await axios.get('https://api.odsay.com/v1/api/searchPubTransPathT', {
      params: {
        apiKey: apiKey,
        SX: origin.lng,
        SY: origin.lat,
        EX: destination.lng,
        EY: destination.lat,
        OPT: 0
      }
    });

    const pathData = response.data.result.path.slice(0, 3);
    const routes = pathData.map((item, index) => ({
      rank: index + 1,
      title: `추천 경로 ${index + 1}`,
      totalTime: item.info.totalTime,
      transitCount: item.info.busTransitCount + item.info.subwayTransitCount - 1,
      subPaths: item.subPath.map(sp => ({
        type: sp.trafficType === 1 ? '지하철' : sp.trafficType === 2 ? '버스' : '도보',
        lane: sp.lane && sp.lane[0] ? (sp.lane[0].name || sp.lane[0].busNo) : '',
        sectionTime: sp.sectionTime,
        startName: sp.startName,
        endName: sp.endName
      }))
    }));

    res.json({ success: true, direction, updatedAt: new Date().toISOString(), origin, destination, routes });

  } catch (error) {
    console.error('API 에러:', error.message);
    res.status(500).json({ success: false, message: '경로를 불러오지 못했습니다.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 백엔드 서버가 http://localhost:${PORT} 에서 실행 중입니다!`);
});