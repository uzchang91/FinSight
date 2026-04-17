import React, { useState, useEffect, useMemo } from 'react';
import Close from '../assets/icons/close.svg?react';
import MinusD from '../assets/icons/minus_default.svg?react';
import PlusD from '../assets/icons/plus_default.svg?react';
import Heart from '../assets/icons/heart.svg?react';
import StocksOwned from '../assets/icons/stocks_owned.svg?react';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-luxon';
import zoomPlugin from 'chartjs-plugin-zoom';
import { api } from '../config/api';
import './Stocks.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
  CandlestickController,
  CandlestickElement,
  Tooltip,
  Legend,
  zoomPlugin
);

const UP_COLOR = '#FF4766';
const DOWN_COLOR = '#4775FF';

const originalDraw = CandlestickElement.prototype.draw;
CandlestickElement.prototype.draw = function (ctx) {
  const { o, c } = this;
  const isUp = c >= o;

  // Force the color properties the draw method actually reads
  this.options.color = isUp ? UP_COLOR : DOWN_COLOR;
  this.options.borderColor = isUp ? UP_COLOR : DOWN_COLOR;

  originalDraw.call(this, ctx);
};

const tabTitleMap = {
  popular: '인기 종목',
  rising: '급상승 종목',
  falling: '급하락 종목',
};

const RANGES = [
  { label: '1주', range: '1w', interval: '1d' },
  { label: '1개월', range: '1m', interval: '1d' },
  { label: '3개월', range: '3m', interval: '1d' },
  { label: '1년', range: '1y', interval: '1w' },
  { label: '5년', range: '5y', interval: '1m' },
];

const Stocks = () => {
  const [activeTab, setActiveTab] = useState('popular');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Main list chart state ──
  const [expandedSymbol, setExpandedSymbol] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('일');
  const chartContainerRef = React.useRef(null);
  const chartInstanceRef = React.useRef(null);

  // ── Owned-panel chart state (fully independent) ──
  const [expandedOwnedCode, setExpandedOwnedCode] = useState(null);
  const [ownedChartData, setOwnedChartData] = useState(null);
  const [ownedRangeLabel, setOwnedRangeLabel] = useState('일');
  const ownedChartContainerRef = React.useRef(null);
  const ownedChartInstanceRef = React.useRef(null);

  // ── Liked-panel chart state (fully independent) ──
  const [expandedLikedCode, setExpandedLikedCode] = useState(null);
  const [likedChartData, setLikedChartData] = useState(null);
  const [likedRangeLabel, setLikedRangeLabel] = useState('일');
  const likedChartContainerRef = React.useRef(null);
  const likedChartInstanceRef = React.useRef(null);

  const [tradeModal, setTradeModal] = useState({ isOpen: false, type: '', stock: null, });

  const [tradeQuantity, setTradeQuantity] = useState(0);
  const [tradeLoading, setTradeLoading] = useState(false);

  const [tradeHistory, setTradeHistory] = useState([]);
  const [ownedStocks, setOwnedStocks] = useState([]);
  const [likedStocks, setLikedStocks] = useState([]);
  const [likedCodeSet, setLikedCodeSet] = useState(new Set());
  const [sideTab, setSideTab] = useState('owned');
  const [sparklineMap, setSparklineMap] = useState({});
  const [sparklineWidths, setSparklineWidths] = useState({});
  const sparklineRefs = React.useRef({});

  const normalizeArray = (res) => {
    const data = res?.data?.data ?? res?.data ?? [];
    return Array.isArray(data) ? data : [];
  };

  const getStockCode = (stock) =>
    String(stock?.symbol ?? stock?.stockCode ?? '').padStart(6, '0');

  const getStockName = (stock) => stock?.name ?? stock?.stockName ?? '알 수 없음';

  const getStockPrice = (stock) => Number(stock?.price ?? 0);

  const toTradeStock = (stock) => ({
    symbol: getStockCode(stock),
    name: getStockName(stock),
    price: getStockPrice(stock),
  });

  const fetchTradeHistory = async () => {
    try {
      const res = await api.get('/api/points/notifications');

      const payload = res?.data?.data ? res.data : res?.data ? res : {};
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      const tradeData = list
        .filter((item) => {
          const type = String(item.type || '');
          return (
            type.includes('매수') || type.includes('매도')
          );
        })
        .map((item) => {
          const typeText = String(item.type || '');
          const isBuy = typeText.includes('매수');
          const isSell = typeText.includes('매도');

          const match = typeText.match(/^\[(매수|매도)\]\s(.*)\s(\d+)주$/);

          const dateObj = new Date(item.createdAt);
          const y = dateObj.getFullYear();
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const d = String(dateObj.getDate()).padStart(2, '0');
          const hh = String(dateObj.getHours()).padStart(2, '0');
          const mm = String(dateObj.getMinutes()).padStart(2, '0');
          const dateStr = `${y}. ${m}. ${d} ${hh}:${mm}`;

          if (!match) return null;

          const stockName = match.at(2) || '알 수 없음';
          const quantity = match.at(3) || '0';
          const price = Math.abs(Number(item.changeAmount));

          return {
            id: item.history_id,
            stockName,
            type: isBuy ? 'buy' : isSell ? 'sell' : 'etc',
            quantity,
            price,
            date: dateStr,
          };
        })
        .filter(Boolean)
        .slice(0, 10);

      setTradeHistory(tradeData);
    } catch (err) {
      console.error('매매 내역 로딩 실패:', err);
      setTradeHistory([]);
    }
  };

  const fetchStocks = async (keyword = '') => {
    setLoading(true);
    setExpandedSymbol(null);
    setChartData(null);

    try {
      const url = keyword
        ? `/api/stocks?keyword=${encodeURIComponent(keyword)}`
        : `/api/stocks?type=${activeTab}`;

      const res = await api.get(url);
      const resultData = normalizeArray(res);
      setStocks(resultData);
      resultData.forEach(stock => fetchSparkline(getStockCode(stock)));
    } catch (err) {
      console.error('주식 목록 로드 실패:', err);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSideStocks = async () => {
    try {
      const [ownedRes, likedRes] = await Promise.all([
        api.get('/api/stocks/owned'),
        api.get('/api/stocks/liked'),
      ]);

      const ownedData = normalizeArray(ownedRes);
      const likedData = normalizeArray(likedRes);

      setOwnedStocks(ownedData);
      ownedData.forEach(stock => fetchSparkline(String(stock.stockCode).padStart(6, '0')));
      setLikedStocks(likedData);
      likedData.forEach(stock => fetchSparkline(String(stock.stockCode).padStart(6, '0')));
      setLikedCodeSet(new Set(likedData.map((item) => String(item.stockCode).padStart(6, '0'))));
    } catch (err) {
      console.error('사이드 주식 로드 실패:', err);
      setOwnedStocks([]);
      setLikedStocks([]);
      setLikedCodeSet(new Set());
    }
  };

  const fetchSparkline = async (stockCode) => {
    if (sparklineMap[stockCode]) return; // already cached
    try {
      const res = await api.get(`/api/stocks/${stockCode}/chart?range=30d&interval=1d`);
      const data = res?.data?.data ?? res?.data ?? [];
      const closes = Array.isArray(data) ? data.map(p => p.c).filter(Boolean) : [];
      setSparklineMap(prev => ({ ...prev, [stockCode]: closes }));
    } catch {
      setSparklineMap(prev => ({ ...prev, [stockCode]: [] }));
    }
  };

  useEffect(() => {
    if (activeTab !== 'search') {
      fetchStocks();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchSideStocks();
    fetchTradeHistory();
  }, []);

  const handleSearch = () => {
    if (!searchKeyword.trim()) return;
    setActiveTab('search');
    fetchStocks(searchKeyword);
  };

  const handleTabClick = (tab) => {
    setSearchKeyword('');
    setActiveTab(tab);
  };

  const fetchStockChart = async (symbol, rangeItem) => {
    setSelectedRangeLabel(rangeItem.label);
    setChartData(null);

    try {
      const res = await api.get(
        `/api/stocks/${symbol}/chart?range=${rangeItem.range}&interval=${rangeItem.interval}`
      );

      let resultData = res?.data?.data ?? res?.data ?? [];

      if (Array.isArray(resultData)) {
        resultData = [...resultData].sort((a, b) => {
          const ax = new Date(a.x).getTime();
          const bx = new Date(b.x).getTime();
          return ax - bx;
        });
      } else {
        resultData = [];
      }

      setChartData({
        datasets: [
          {
            data: resultData, // colors are now controlled by CandlestickElement.defaults above
          },
        ],
      });
    } catch (err) {
      console.error('차트 로드 실패:', err);
      setChartData(null);
    }
  };

  // ── Owned-panel chart fetcher ──
  const fetchOwnedChart = async (stockCode, rangeItem) => {
    setOwnedRangeLabel(rangeItem.label);
    setOwnedChartData(null);
    try {
      const res = await api.get(
        `/api/stocks/${stockCode}/chart?range=${rangeItem.range}&interval=${rangeItem.interval}`
      );
      let resultData = res?.data?.data ?? res?.data ?? [];
      if (Array.isArray(resultData)) {
        resultData = [...resultData].sort((a, b) => new Date(a.x) - new Date(b.x));
      } else {
        resultData = [];
      }
      setOwnedChartData({ datasets: [{ data: resultData }] });
    } catch (err) {
      console.error('보유 주식 차트 로드 실패:', err);
      setOwnedChartData(null);
    }
  };

  const handleOwnedStockClick = (stockCode) => {
    if (expandedOwnedCode === stockCode) {
      setExpandedOwnedCode(null);
      setOwnedChartData(null);
      return;
    }
    setExpandedOwnedCode(stockCode);
    const defaultRange = RANGES.find((r) => r.label === '일');
    if (defaultRange) fetchOwnedChart(stockCode, defaultRange);
  };

  // ── Liked-panel chart fetcher ──
  const fetchLikedChart = async (stockCode, rangeItem) => {
    setLikedRangeLabel(rangeItem.label);
    setLikedChartData(null);
    try {
      const res = await api.get(
        `/api/stocks/${stockCode}/chart?range=${rangeItem.range}&interval=${rangeItem.interval}`
      );
      let resultData = res?.data?.data ?? res?.data ?? [];
      if (Array.isArray(resultData)) {
        resultData = [...resultData].sort((a, b) => new Date(a.x) - new Date(b.x));
      } else {
        resultData = [];
      }
      setLikedChartData({ datasets: [{ data: resultData }] });
    } catch (err) {
      console.error('관심 주식 차트 로드 실패:', err);
      setLikedChartData(null);
    }
  };

  const handleLikedStockClick = (stockCode) => {
    if (expandedLikedCode === stockCode) {
      setExpandedLikedCode(null);
      setLikedChartData(null);
      return;
    }
    setExpandedLikedCode(stockCode);
    const defaultRange = RANGES.find((r) => r.label === '일');
    if (defaultRange) fetchLikedChart(stockCode, defaultRange);
  };

  const handleStockClick = async (symbol) => {
    if (expandedSymbol === symbol) {
      setExpandedSymbol(null);
      setChartData(null);
      return;
    }
    setExpandedSymbol(symbol);
    const defaultRange = RANGES.find((r) => r.label === '일');
    if (defaultRange) fetchStockChart(symbol, defaultRange);
  };

  const openTradeModal = (type, stock, e) => {
    e?.stopPropagation?.();
    setTradeModal({
      isOpen: true,
      type,
      stock: toTradeStock(stock),
    });
    setTradeQuantity(1); // 0으로 변경
  };

  const closeTradeModal = () => {
    if (tradeLoading) return;
    setTradeModal({ isOpen: false, type: '', stock: null });
    setTradeQuantity(1); // 0으로 변경
  };

  const isLiked = (stockCode) => likedCodeSet.has(String(stockCode).padStart(6, '0'));

  const handleToggleLike = async (stock, e) => {
    e?.stopPropagation?.();

    const stockCode = getStockCode(stock);

    try {
      const res = await api.post(`/api/stocks/${stockCode}/like`);
      const payload = res?.data?.data ?? res?.data ?? {};
      const liked = Boolean(payload.liked);

      setLikedCodeSet((prev) => {
        const next = new Set(prev);
        if (liked) next.add(stockCode);
        else next.delete(stockCode);
        return next;
      });

      await Promise.all([
        fetchSideStocks(),
        fetchTradeHistory(),
      ]);

      window.dispatchEvent(new Event('pointsUpdated'));
    } catch (err) {
      console.error('관심 토글 실패:', err);
      alert(err?.response?.data?.message || err?.message || '관심하기 처리에 실패했습니다.');
    }
  };

  const handleTradeSubmit = async () => {
    if (!tradeModal.stock) return;

    const quantity = Number(tradeQuantity);
    const unitPrice = Number(tradeModal.stock.price);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      alert('수량은 1 이상의 정수여야 합니다.');
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      alert('현재 가격 정보가 올바르지 않습니다.');
      return;
    }

    const actionPath = tradeModal.type === 'buy' ? 'buy' : 'sell';

    try {
      setTradeLoading(true);

      const res = await api.post(`/api/stocks/${tradeModal.stock.symbol}/${actionPath}`, {
        quantity,
        unitPrice,
      });

      const message =
        res?.data?.message || (tradeModal.type === 'buy' ? '매수 완료' : '매도 완료');

      alert(message);

      await Promise.all([
        fetchSideStocks(),
        activeTab === 'search' ? fetchStocks(searchKeyword) : fetchStocks(),
        fetchTradeHistory(),
      ]);

      window.dispatchEvent(new Event('pointsUpdated'));

      // 매수/매도 후 ISR 재계산 (fire-and-forget)
      api.post('/api/isr/me/calculate').catch((err) => {
        console.error('ISR 재계산 실패:', err)
      })

      closeTradeModal();
    } catch (err) {
      console.error('거래 실패:', err);
      alert(err?.response?.data?.message || err?.message || '거래 처리에 실패했습니다.');
    } finally {
      setTradeLoading(false);
    }
  };

  // Resize main list chart on container resize
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !expandedSymbol) return;
    const ro = new ResizeObserver(() => {
      if (chartInstanceRef.current) chartInstanceRef.current.resize();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [expandedSymbol, chartData]);

  // Resize owned-panel chart on container resize
  useEffect(() => {
    const container = ownedChartContainerRef.current;
    if (!container || !expandedOwnedCode) return;
    const ro = new ResizeObserver(() => {
      if (ownedChartInstanceRef.current) ownedChartInstanceRef.current.resize();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [expandedOwnedCode, ownedChartData]);

  // Resize liked-panel chart on container resize
  useEffect(() => {
    const container = likedChartContainerRef.current;
    if (!container || !expandedLikedCode) return;
    const ro = new ResizeObserver(() => {
      if (likedChartInstanceRef.current) likedChartInstanceRef.current.resize();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [expandedLikedCode, likedChartData]);

  // Observe sparkline container widths responsively
  useEffect(() => {
    const observers = [];
    Object.entries(sparklineRefs.current).forEach(([code, el]) => {
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setSparklineWidths(prev => ({ ...prev, [code]: w }));
      });
      ro.observe(el);
      observers.push(ro);
    });
    return () => observers.forEach(ro => ro.disconnect());
  }, [stocks, ownedStocks, likedStocks]);

  const buildChartOptions = (rangeLabel) => {
    let timeUnit = 'month', xFormat = 'MM/dd', tipFormat = 'yyyy-MM-dd';
    if (rangeLabel === '일') { timeUnit = 'day'; xFormat = 'MM/dd'; tipFormat = 'yyyy-MM-dd'; }
    else if (rangeLabel === '주') { timeUnit = 'month'; xFormat = 'yy.MM'; tipFormat = 'yyyy-MM-dd'; }
    else if (rangeLabel === '월') { timeUnit = 'year'; xFormat = 'yyyy.MM'; tipFormat = 'yyyy-MM'; }
    else if (rangeLabel === '년') { timeUnit = 'year'; xFormat = 'yyyy'; tipFormat = 'yyyy-MM'; }

    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 5, right: 5, top: 10, bottom: 0 } },
      scales: {
        x: {
          type: 'timeseries',
          time: {
            unit: timeUnit,
            displayFormats: { day: xFormat, month: xFormat, year: xFormat },
            tooltipFormat: tipFormat,
          },
          bounds: 'data',
          grid: { display: false, drawBorder: false },
          ticks: { autoSkip: true, maxTicksLimit: 6, maxRotation: 0, color: '#8b95a1', font: { size: 12, weight: '500' } },
        },
        y: {
          position: 'right',
          grid: { color: '#ececec', drawBorder: false },
          border: { display: false },
          ticks: { color: '#8b95a1', font: { size: 12 }, callback: (v) => Number(v).toLocaleString() },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 8,
          titleFont: { size: 14 },
          bodyFont: { size: 14 },
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw;
              if (!p) return '';
              return [
                `시가: ${Number(p.o).toLocaleString()}pt`,
                `고가: ${Number(p.h).toLocaleString()}pt`,
                `저가: ${Number(p.l).toLocaleString()}pt`,
                `종가: ${Number(p.c).toLocaleString()}pt`,
              ];
            },
          },
        },
        zoom: {
          limits: { x: { min: 'original', max: 'original' } },
          pan: { enabled: true, mode: 'x' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
        },
      },
    };
  };

  const chartOptions = buildChartOptions(selectedRangeLabel);
  const ownedChartOptions = buildChartOptions(ownedRangeLabel);
  const likedChartOptions = buildChartOptions(likedRangeLabel);

  const ownedMap = useMemo(() => {
    const map = new Map();
    ownedStocks.forEach((item) => {
      map.set(String(item.stockCode).padStart(6, '0'), item);
    });
    return map;
  }, [ownedStocks]);

  return (
    <div className='stocks-container'>
      <div className='breadcrumb'>대시보드 &gt; 주식</div>

      <div className='stocks-layout'>
        <div className='stocks-side'>
          <div className='stocks-card'>
            <h3><StocksOwned />보유 주식</h3>
            <div className='stocks-card-body'>
              {ownedStocks.length > 0 ? (
                ownedStocks.map((stock) => {
                  const ownedCode = String(stock.stockCode).padStart(6, '0');
                  const isExpanded = expandedOwnedCode === ownedCode;

                  return (
                    <div key={`owned-${stock.stockCode}`} className='stock-item-wrap'>
                      <div
                        className='side-stock-item-owned'
                        onClick={() => handleOwnedStockClick(ownedCode)}
                      >
                        <div className='side-stock-top'>
                          <p>{stock.stockName}</p>
                          <div
                            className='stock-sparkline'
                            ref={el => { sparklineRefs.current[ownedCode] = el; }}
                          >
                            <Sparklines data={sparklineMap[ownedCode] ?? []} width={sparklineWidths[ownedCode] || 70} height={24}>
                              <SparklinesLine
                                color={Number(stock.myChangeRate || 0) >= 0 ? '#FF4766' : '#4775FF'}
                                style={{
                                  fill: Number(stock.myChangeRate || 0) >= 0 ? '#FF4766' : '#4775FF',
                                  strokeWidth: 1,
                                }}
                              />
                            </Sparklines>
                          </div>
                          <span>{stock.quantity}주</span>
                          <div className='side-stock-end'>
                            <p>
                              {stock.price !== null && stock.totalPrice !== undefined
                                ? `${Number(stock.totalPrice).toLocaleString()}`
                                : '-'}
                              <span>pt</span>
                            </p>
                            <p>
                              <span className={Number(stock.myChangeRate || 0) >= 0 ? 'stocks-up' : 'stocks-down'}>
                                ({stock.myChangeRate !== null && stock.myChangeRate !== undefined
                                  ? `${Number(stock.myChangeRate) >= 0 ? '+' : ''}${Number(stock.myChangeRate).toFixed(2)}%`
                                  : '-'})
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className={`side-stock-actions ${isExpanded ? 'flex' : ''}`}>
                          <button className='trade-btn buy' onClick={(e) => openTradeModal('buy', stock, e)}>매수</button>
                          <button className='trade-btn sell' onClick={(e) => openTradeModal('sell', stock, e)}>매도</button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className='stock-chart-expanded'>
                          <div className='chart-toolbar'>
                            <div className='chart-legend-badge'>
                              <span className='legend-item'><span className='color-box up'></span> 상승</span>
                              <span className='legend-item'><span className='color-box down'></span> 하락</span>
                            </div>
                            <div className='chart-range-group'>
                              {RANGES.map((r) => (
                                <button
                                  key={r.label}
                                  className={`chart-range-btn ${ownedRangeLabel === r.label ? 'active' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); fetchOwnedChart(ownedCode, r); }}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className='chart-render-area' ref={ownedChartContainerRef}>
                            {ownedChartData ? (
                              <Chart
                                key={`owned-${ownedCode}-${ownedRangeLabel}`}
                                ref={ownedChartInstanceRef}
                                type='candlestick'
                                data={ownedChartData}
                                options={ownedChartOptions}
                              />
                            ) : (
                              <div className='stocks-empty'>차트 로딩 중...</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className='stocks-empty'>보유 주식이 없습니다.</div>
              )}
            </div>
          </div>

          <div className='stocks-card'>
            <h3><Heart />관심 주식</h3>
            <div className='stocks-card-body'>
              {likedStocks.length > 0 ? (
                likedStocks.map((stock) => {
                  const likedCode = String(stock.stockCode);
                  const liked = isLiked(stock.stockCode);
                  const isExpanded = expandedLikedCode === likedCode;

                  return (
                    <div key={`liked-${stock.stockCode}`} className='stock-item-wrap'>
                      <div
                        className='side-stock-item-owned'
                        onClick={() => handleLikedStockClick(likedCode)}
                      >
                        <div className='side-stock-top-liked'>
                          <p>{stock.stockName}</p>
                          <div
                            className='stock-sparkline'
                            ref={el => { sparklineRefs.current[`liked-${likedCode}`] = el; }}
                          >
                            <Sparklines data={sparklineMap[likedCode] ?? []} width={sparklineWidths[`liked-${likedCode}`] || 70} height={24}>
                              <SparklinesLine
                                color={Number(stock.changeRate || 0) >= 0 ? '#FF4766' : '#4775FF'}
                                style={{
                                  fill: Number(stock.changeRate || 0) >= 0 ? '#FF4766' : '#4775FF',
                                  strokeWidth: 1,
                                }}
                              />
                            </Sparklines>
                          </div>
                          <div className='side-stock-end'>
                            <p>
                              {stock.price != null ? Number(stock.price).toLocaleString() : '-'}
                              <span>pt</span>
                            </p>
                            <span className={Number(stock.changeRate || 0) >= 0 ? 'stocks-up' : 'stocks-down'}>
                              ({Number(stock.changeRate || 0) >= 0 ? '+' : ''}
                              {Number(stock.changeRate || 0).toFixed(2)}%)
                            </span>
                          </div>
                        </div>

                        <div className={`side-liked-actions ${isExpanded ? 'flex' : ''}`}>
                          <button
                            type='button'
                            className='side-like-btn liked'
                            onClick={(e) => handleToggleLike(stock, e)}
                            title='관심 해제'
                          >
                            {liked ? '♥' : '♡'}
                          </button>
                          <button
                            type='button'
                            className='trade-btn buy'
                            onClick={(e) => openTradeModal('buy', stock, e)}
                          >
                            매수
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className='stock-chart-expanded'>
                          <div className='chart-toolbar'>
                            <div className='chart-legend-badge'>
                              <span className='legend-item'><span className='color-box up'></span> 상승</span>
                              <span className='legend-item'><span className='color-box down'></span> 하락</span>
                            </div>
                            <div className='chart-range-group'>
                              {RANGES.map((r) => (
                                <button
                                  key={r.label}
                                  className={`chart-range-btn ${likedRangeLabel === r.label ? 'active' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); fetchLikedChart(likedCode, r); }}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className='chart-render-area' ref={likedChartContainerRef}>
                            {likedChartData ? (
                              <Chart
                                key={`liked-${likedCode}-${likedRangeLabel}`}
                                ref={likedChartInstanceRef}
                                type='candlestick'
                                data={likedChartData}
                                options={likedChartOptions}
                              />
                            ) : (
                              <div className='stocks-empty'>차트 로딩 중...</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className='stocks-empty'>관심 주식이 없습니다.</div>
              )}
            </div>
          </div>

        </div>
        <div className='stocks-main'>
          <div className='stocks-search-row'>
            <input
              type='text'
              className='stocks-search-input'
              placeholder='종목코드 또는 이름 검색'
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className='stocks-search-btn' onClick={handleSearch}>
              검색
            </button>
          </div>

          <div className='stocks-tab-group'>
            {Object.keys(tabTitleMap).map((tab) => (
              <button
                key={tab}
                className={`stocks-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => handleTabClick(tab)}
              >
                {tabTitleMap[tab]}
              </button>
            ))}
          </div>

          <div className='stocks-chart-panel'>
            <div className='stocks-panel-header'>
              <h3>{activeTab === 'search' ? '검색 종목' : tabTitleMap[activeTab]}</h3>
              <span>{stocks.length}개 종목</span>
            </div>

            <div className='stocks-list'>
              {loading ? (
                <div className='stocks-empty'>데이터 로딩 중...</div>
              ) : stocks.length > 0 ? (
                stocks.map((stock, index) => {
                  const stockCode = getStockCode(stock);
                  const liked = isLiked(stockCode);
                  const ownedInfo = ownedMap.get(stockCode);

                  return (
                    <div key={stockCode} className='stock-item-wrap'
                          onClick={() => handleStockClick(stockCode)}
                    >
                      <div className='stocks-list-item'>
                        <div className='stock-info-clickable'>
                          <div className='stocks-info-group'>
                            <div className='stock-rank-badge'>{index + 1}</div>

                            <div className='stocks-item-left'>
                              <span className='stocks-item-title'>{stock.name}</span>
                              {ownedInfo ? (
                                <span className='stocks-owned-badge'>
                                  보유 {ownedInfo.quantity}주
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className='stocks-item-right'>
                            <span className='stocks-item-price'>
                              {Number(stock.price || 0).toLocaleString()}
                              <span>pt</span>
                            </span>
                            <div className='stocks-description'>
                              <span className=
                                {Number(stock.change || 0) >= 0 ? 'stocks-up' : 'stocks-down'}
                              >
                                {Number(stock.change || 0) >= 0 ? '+' : ''}
                                {Number(stock.change || 0).toLocaleString()}
                                <span>pt</span>
                              </span>
                              <span
                                className={Number(stock.rate || 0) >= 0 ? 'stocks-up' : 'stocks-down'}
                              >
                                ({Number(stock.rate || 0) >= 0 ? '+' : ''}
                                {Number(stock.rate || 0).toFixed(2)}%)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className='stock-trade-btns'>
                          <button
                            type='button'
                            className={`side-like-btn ${liked ? 'liked' : ''}`}
                            onClick={(e) => handleToggleLike(stock, e)}
                            title={liked ? '관심 해제' : '관심하기'}
                          >
                            {liked ? '♥' : '♡'}
                          </button>

                          <button
                            className='trade-btn buy'
                            onClick={(e) => openTradeModal('buy', stock, e)}
                          >
                            매수
                          </button>
                          <button
                            className='trade-btn sell'
                            onClick={(e) => openTradeModal('sell', stock, e)}
                          >
                            매도
                          </button>
                        </div>
                      </div>

                      {expandedSymbol === stockCode && (
                        <div className='stock-chart-expanded'>
                          <div className='chart-toolbar'>
                            <div className='chart-legend-badge'>
                              <span className='legend-item'>
                                <span className='color-box up'></span> 상승
                              </span>
                              <span className='legend-item'>
                                <span className='color-box down'></span> 하락
                              </span>
                            </div>

                            <div className='chart-range-group'>
                              {RANGES.map((r) => (
                                <button
                                  key={r.label}
                                  className={`chart-range-btn ${selectedRangeLabel === r.label ? 'active' : ''
                                    }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    fetchStockChart(stockCode, r);
                                  }}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className='chart-render-area' ref={chartContainerRef}>
                            {chartData ? (
                              <Chart
                                key={`${expandedSymbol}-${selectedRangeLabel}`}
                                ref={chartInstanceRef}
                                type='candlestick' data={chartData}
                                options={chartOptions} />
                            ) : (
                              <div className='stocks-empty'>차트 로딩 중...</div>
                            )}
                          </div>

                          <div className='chart-notice'>
                            * 본 차트는 글로벌 금융 표준 색상(상승: 초록색, 하락: 빨간색)을 따르고 있습니다.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className='stocks-empty'>조회된 종목이 없습니다.</div>
              )}
            </div>
          </div>
        </div>


      </div>

      {
        tradeModal.isOpen && tradeModal.stock && (
          <div className='trade-modal-overlay' onClick={closeTradeModal}>
            <div className='trade-modal-content' onClick={(e) => e.stopPropagation()}>
              <div className='trade-modal-header'>
                <h2>{tradeModal.stock.name}</h2>
                <button className='trade-modal-close' onClick={closeTradeModal}>
                  <Close alt="닫기" />
                </button>
              </div>

              <div className='trade-modal-body'>
                <div className='trade-info-row'>
                  <span>현재가</span>
                  <strong>{Number(tradeModal.stock.price || 0).toLocaleString()}pt</strong>
                </div>

                <div className='trade-quantity-control'>
                  <span>수량</span>
                  <div className='quantity-buttons'>
                    <button
                      type='button'
                      onClick={() => setTradeQuantity((prev) => Math.max(0, Number(prev) - 1))}
                      disabled={tradeLoading}
                    >
                      <MinusD alt="빼기" />
                    </button>
                    <input
                      type='number'
                      min='0'
                      placeholder='0'
                      value={tradeQuantity === 0 ? '' : tradeQuantity} /* 0일 땐 빈칸으로 둬서 바로 입력되게 함 */
                      onFocus={(e) => (e.target.placeholder = '')} /* 🟢 마우스로 클릭하면 회색 '0' 삭제 */
                      onBlur={(e) => (e.target.placeholder = '0')} /* 🟢 다른 곳을 누르면 다시 회색 '0' 복구 */
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setTradeQuantity(0);
                        } else {
                          const num = Number(val);
                          if (Number.isFinite(num) && num >= 0) {
                            setTradeQuantity(Math.floor(num));
                          }
                        }
                      }}
                      disabled={tradeLoading}
                    />
                    <button
                      type='button'
                      onClick={() => setTradeQuantity((prev) => Number(prev) + 1)}
                      disabled={tradeLoading}
                    >
                      <PlusD alt="더하기" />
                    </button>
                  </div>
                </div>

                <div className='trade-total-price'>
                  <span>총 주문 금액</span>
                  <strong className={tradeModal.type === 'buy' ? 'text-red' : 'text-blue'}>
                    {(Number(tradeModal.stock.price || 0) * tradeQuantity).toLocaleString()}pt
                  </strong>
                </div>
              </div>

              <div className='trade-modal-footer'>
                <button className='btn-cancel' onClick={closeTradeModal} disabled={tradeLoading}>
                  취소
                </button>
                <button
                  className={`submit-btn ${tradeModal.type}`}
                  onClick={handleTradeSubmit}
                  disabled={tradeLoading}
                >
                  {tradeLoading ? '처리 중...' : tradeModal.type === 'buy' ? '매수하기' : '매도하기'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Stocks;