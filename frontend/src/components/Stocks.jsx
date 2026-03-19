import React, { useState, useEffect, useMemo } from 'react';
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

const tabTitleMap = {
  popular: '인기 종목',
  rising: '급상승 종목',
  falling: '급하락 종목',
};

const RANGES = [
  { label: '일', range: '6mo', interval: '1d' },
  { label: '주', range: '2y', interval: '1wk' },
  { label: '월', range: '5y', interval: '1mo' },
  { label: '년', range: '10y', interval: '3mo' },
];

const Stocks = () => {
  const [activeTab, setActiveTab] = useState('popular');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedSymbol, setExpandedSymbol] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('일');

  const [tradeModal, setTradeModal] = useState({
    isOpen: false,
    type: '',
    stock: null,
  });
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [tradeLoading, setTradeLoading] = useState(false);

  const [ownedStocks, setOwnedStocks] = useState([]);
  const [likedStocks, setLikedStocks] = useState([]);
  const [likedCodeSet, setLikedCodeSet] = useState(new Set());

  const normalizeArray = (res) => {
    const data = res?.data?.data ?? res?.data ?? [];
    return Array.isArray(data) ? data : [];
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
      setLikedStocks(likedData);
      setLikedCodeSet(new Set(likedData.map((item) => String(item.stockCode))));
    } catch (err) {
      console.error('사이드 주식 로드 실패:', err);
      setOwnedStocks([]);
      setLikedStocks([]);
      setLikedCodeSet(new Set());
    }
  };

  useEffect(() => {
    if (activeTab !== 'search') {
      fetchStocks();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchSideStocks();
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
            data: resultData,
            color: {
              up: '#26a69a',
              down: '#ef4444',
              unchanged: '#999',
            },
          },
        ],
      });
    } catch (err) {
      console.error('차트 로드 실패:', err);
      setChartData(null);
    }
  };

  const handleStockClick = async (symbol) => {
    if (expandedSymbol === symbol) {
      setExpandedSymbol(null);
      setChartData(null);
      return;
    }

    setExpandedSymbol(symbol);

    const defaultRange = RANGES.find((r) => r.label === '일');
    if (defaultRange) {
      fetchStockChart(symbol, defaultRange);
    }
  };

  const openTradeModal = (type, stock, e) => {
    e.stopPropagation();
    setTradeModal({ isOpen: true, type, stock });
    setTradeQuantity(1);
  };

  const closeTradeModal = () => {
    if (tradeLoading) return;
    setTradeModal({ isOpen: false, type: '', stock: null });
    setTradeQuantity(1);
  };

  const isLiked = (stockCode) => likedCodeSet.has(String(stockCode));

  const handleToggleLike = async (stock, e) => {
    e.stopPropagation();

    try {
      const res = await api.post(`/api/stocks/${stock.symbol}/like`);
      const payload = res?.data?.data ?? res?.data ?? {};
      const liked = Boolean(payload.liked);

      setLikedCodeSet((prev) => {
        const next = new Set(prev);
        if (liked) next.add(String(stock.symbol));
        else next.delete(String(stock.symbol));
        return next;
      });

      await fetchSideStocks();
    } catch (err) {
      console.error('찜 토글 실패:', err);
      alert(err?.response?.data?.message || '찜하기 처리에 실패했습니다.');
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
      ]);

      window.dispatchEvent(new Event('pointsUpdated'));
      closeTradeModal();
    } catch (err) {
      console.error('거래 실패:', err);
      alert(err?.response?.data?.message || '거래 처리에 실패했습니다.');
    } finally {
      setTradeLoading(false);
    }
  };

  let timeUnit = 'month';
  let xFormat = 'MM/dd';
  let tipFormat = 'yyyy-MM-dd';

  if (selectedRangeLabel === '일') {
    timeUnit = 'day';
    xFormat = 'MM/dd';
    tipFormat = 'yyyy-MM-dd';
  } else if (selectedRangeLabel === '주') {
    timeUnit = 'month';
    xFormat = 'yy.MM';
    tipFormat = 'yyyy-MM-dd';
  } else if (selectedRangeLabel === '월') {
    timeUnit = 'year';
    xFormat = 'yyyy.MM';
    tipFormat = 'yyyy-MM';
  } else if (selectedRangeLabel === '년') {
    timeUnit = 'year';
    xFormat = 'yyyy';
    tipFormat = 'yyyy-MM';
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 5,
        right: 5,
        top: 10,
        bottom: 0,
      },
    },
    scales: {
      x: {
        type: 'timeseries',
        time: {
          unit: timeUnit,
          displayFormats: {
            day: xFormat,
            month: xFormat,
            year: xFormat,
          },
          tooltipFormat: tipFormat,
        },
        bounds: 'data',
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 6,
          maxRotation: 0,
          color: '#8b95a1',
          font: {
            size: 11,
            weight: '500',
          },
        },
      },
      y: {
        position: 'right',
        grid: {
          color: '#f2f4f6',
          drawBorder: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: '#8b95a1',
          font: {
            size: 11,
          },
          callback: function (value) {
            return Number(value).toLocaleString();
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 10,
        titleFont: {
          size: 13,
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: (context) => {
            const point = context.raw;
            if (!point) return '';

            return [
              `시가: ${Number(point.o).toLocaleString()}원`,
              `고가: ${Number(point.h).toLocaleString()}원`,
              `저가: ${Number(point.l).toLocaleString()}원`,
              `종가: ${Number(point.c).toLocaleString()}원`,
            ];
          },
        },
      },
      zoom: {
        limits: {
          x: { min: 'original', max: 'original' },
        },
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
        },
      },
    },
  };

  const ownedMap = useMemo(() => {
    const map = new Map();
    ownedStocks.forEach((item) => {
      map.set(String(item.stockCode), item);
    });
    return map;
  }, [ownedStocks]);

  return (
    <div className='stocks-container'>
      <div className='stocks-breadcrumb'>대시보드 &gt; 전략실 &gt; 주식</div>

      <div className='stocks-layout'>
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
                  const liked = isLiked(stock.symbol);
                  const ownedInfo = ownedMap.get(String(stock.symbol));

                  return (
                    <div key={stock.symbol} className='stock-item-wrap'>
                      <div
                        className='stocks-list-item'
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '15px',
                          gap: '12px',
                        }}
                      >
                        <div
                          className='stock-info-clickable'
                          onClick={() => handleStockClick(stock.symbol)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            paddingRight: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div className='stock-rank-badge'>{index + 1}</div>

                            <div
                              className='stocks-item-left'
                              style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}
                            >
                              <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {stock.name}
                              </span>
                              <span style={{ fontSize: '0.9rem', color: '#666' }}>
                                {Number(stock.price || 0).toLocaleString()}원
                              </span>
                              {ownedInfo ? (
                                <span
                                  style={{
                                    fontSize: '0.8rem',
                                    color: '#4f46e5',
                                    fontWeight: 600,
                                  }}
                                >
                                  보유 {ownedInfo.quantity}주
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div
                            className='stocks-item-right'
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-end',
                              gap: '5px',
                            }}
                          >
                            <span
                              className={Number(stock.change || 0) >= 0 ? 'stocks-up' : 'stocks-down'}
                              style={{ fontWeight: 'bold' }}
                            >
                              {Number(stock.change || 0) >= 0 ? '+' : ''}
                              {Number(stock.change || 0).toLocaleString()}원
                            </span>
                            <span
                              className={Number(stock.rate || 0) >= 0 ? 'stocks-up' : 'stocks-down'}
                              style={{ fontWeight: 'bold' }}
                            >
                              {Number(stock.rate || 0) >= 0 ? '+' : ''}
                              {Number(stock.rate || 0).toFixed(2)}%
                            </span>
                          </div>
                        </div>

                        <div
                          className='stock-trade-btns'
                          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                        >
                          <button
                            type='button'
                            onClick={(e) => handleToggleLike(stock, e)}
                            title={liked ? '찜 해제' : '찜하기'}
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '12px',
                              border: liked ? '1px solid #fecaca' : '1px solid #dbe2f0',
                              background: liked ? '#fff1f2' : '#ffffff',
                              cursor: 'pointer',
                              fontSize: '1.2rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
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

                      {expandedSymbol === stock.symbol && (
                        <div
                          className='stock-chart-expanded'
                          style={{
                            height: '420px',
                            padding: '15px',
                            backgroundColor: '#fcfcfd',
                          }}
                        >
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
                                  className={`chart-range-btn ${
                                    selectedRangeLabel === r.label ? 'active' : ''
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    fetchStockChart(stock.symbol, r);
                                  }}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div style={{ height: '310px' }}>
                            {chartData ? (
                              <Chart type='candlestick' data={chartData} options={chartOptions} />
                            ) : (
                              <div style={{ padding: '20px' }}>차트 로딩 중...</div>
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

        <div className='stocks-side'>
          <div className='stocks-card'>
            <h3>💹 보유 주식</h3>
            <div className='stocks-card-body'>
              {ownedStocks.length > 0 ? (
                ownedStocks.map((stock) => (
                  <div key={`owned-${stock.stockCode}`} className='side-stock-item'>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ margin: 0 }}>{stock.stockName}</p>
                      <p style={{ margin: 0 }}>
                        {stock.price !== null && stock.price !== undefined
                          ? `${Number(stock.price).toLocaleString()}원`
                          : '-'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        {stock.quantity}주 (평단가 {Number(stock.avgPrice || 0).toLocaleString()}원)
                      </span>
                      <span className={Number(stock.changeRate || 0) >= 0 ? 'stocks-up' : 'stocks-down'}>
                        {stock.changeRate !== null && stock.changeRate !== undefined
                          ? `${Number(stock.changeRate) >= 0 ? '+' : ''}${Number(
                              stock.changeRate
                            ).toFixed(2)}%`
                          : '-'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className='stocks-empty' style={{ minHeight: '6rem' }}>
                  보유 주식이 없습니다.
                </div>
              )}
            </div>
          </div>

          <div className='stocks-card'>
            <h3>💖 찜한 주식</h3>
            <div className='stocks-card-body'>
              {likedStocks.length > 0 ? (
                likedStocks.map((stock) => (
                  <div key={`liked-${stock.stockCode}`} className='side-stock-item'>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ margin: 0 }}>{stock.stockName}</p>
                      <p style={{ margin: 0 }}>
                        {stock.price !== null && stock.price !== undefined
                          ? `${Number(stock.price).toLocaleString()}원`
                          : '-'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: '#777' }}>{stock.stockCode}</span>
                      <span className={Number(stock.changeRate || 0) >= 0 ? 'stocks-up' : 'stocks-down'}>
                        {stock.changeRate !== null && stock.changeRate !== undefined
                          ? `${Number(stock.changeRate) >= 0 ? '+' : ''}${Number(
                              stock.changeRate
                            ).toFixed(2)}%`
                          : '-'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className='stocks-empty' style={{ minHeight: '6rem' }}>
                  찜한 주식이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {tradeModal.isOpen && tradeModal.stock && (
        <div className='trade-modal-overlay' onClick={closeTradeModal}>
          <div className='trade-modal-content' onClick={(e) => e.stopPropagation()}>
            <div className='trade-modal-header'>
              <h2>{tradeModal.stock.name}</h2>
              <button className='trade-modal-close' onClick={closeTradeModal}>
                &times;
              </button>
            </div>

            <div className='trade-modal-body'>
              <div className='trade-info-row'>
                <span>현재가</span>
                <strong>{Number(tradeModal.stock.price || 0).toLocaleString()}원</strong>
              </div>

              <div className='trade-quantity-control'>
                <span>수량</span>
                <div className='quantity-buttons'>
                  <button
                    type='button'
                    onClick={() => setTradeQuantity((prev) => Math.max(1, prev - 1))}
                    disabled={tradeLoading}
                  >
                    -
                  </button>
                  <input
                    type='number'
                    min='1'
                    value={tradeQuantity}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setTradeQuantity(Number.isFinite(value) && value > 0 ? Math.floor(value) : 1);
                    }}
                    disabled={tradeLoading}
                  />
                  <button
                    type='button'
                    onClick={() => setTradeQuantity((prev) => prev + 1)}
                    disabled={tradeLoading}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className='trade-total-price'>
                <span>총 주문 금액</span>
                <strong className={tradeModal.type === 'buy' ? 'text-red' : 'text-blue'}>
                  {(Number(tradeModal.stock.price || 0) * tradeQuantity).toLocaleString()}원
                </strong>
              </div>
            </div>

            <div className='trade-modal-footer'>
              <button className='btn-cancel' onClick={closeTradeModal} disabled={tradeLoading}>
                취소
              </button>
              <button
                className={`btn-submit ${tradeModal.type}`}
                onClick={handleTradeSubmit}
                disabled={tradeLoading}
              >
                {tradeLoading ? '처리 중...' : tradeModal.type === 'buy' ? '매수하기' : '매도하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stocks;