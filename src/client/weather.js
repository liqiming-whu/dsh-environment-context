const HTTP_TIMEOUT_MS = 10_000;
const MAX_HTTP_BODY_BYTES = 1_000_000;
const PROVIDERS = new Set(['open-meteo', 'met-norway', 'wttr.in']);

const WMO_CONDITIONS_ZH = {
    0: '晴', 1: '大部晴朗', 2: '局部多云', 3: '阴', 45: '雾', 48: '雾凇',
    51: '小毛毛雨', 53: '中等毛毛雨', 55: '浓毛毛雨', 56: '轻微冻毛毛雨', 57: '强冻毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨', 66: '轻微冻雨', 67: '强冻雨',
    71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪', 80: '小阵雨', 81: '中阵雨',
    82: '强阵雨', 85: '小阵雪', 86: '强阵雪', 95: '雷暴', 96: '雷暴伴小冰雹', 99: '雷暴伴强冰雹',
};

// World Weather Online weatherCode values used by wttr.in. Kept in sync with
// liqiming-whu/environment_provider (MIT), including the extended code 149.
const WTTR_WEATHER_CODES_ZH = {
    113: '晴', 116: '局部多云', 119: '多云', 122: '阴', 143: '薄雾', 149: '烟霾',
    176: '局部可能有雨', 179: '局部可能有雪', 182: '局部可能有雨夹雪', 185: '局部可能有冻毛毛雨',
    200: '局部可能有雷暴', 227: '风吹雪', 230: '暴雪', 248: '有雾', 260: '冻雾',
    263: '局部毛毛雨', 266: '小毛毛雨', 281: '冻毛毛雨', 284: '强冻毛毛雨',
    293: '局部小雨', 296: '小雨', 299: '间歇性中雨', 302: '中雨', 305: '间歇性大雨', 308: '大雨',
    311: '小冻雨', 314: '中到大冻雨', 317: '小雨夹雪', 320: '中到大雨夹雪',
    323: '局部小雪', 326: '小雪', 329: '局部中雪', 332: '中雪', 335: '局部大雪', 338: '大雪',
    350: '冰粒', 353: '小阵雨', 356: '中到大阵雨', 359: '暴雨',
    362: '小雨夹雪阵雨', 365: '中到大雨夹雪阵雨', 368: '小阵雪', 371: '中到大阵雪',
    374: '小冰粒阵雨', 377: '中到大冰粒阵雨', 386: '局部小雨伴雷电',
    389: '中到大雨伴雷电', 392: '局部小雪伴雷电', 395: '中到大雪伴雷电',
};

const MET_CONDITIONS_ZH = {
    clearsky: '晴', cloudy: '多云', fair: '晴间多云', fog: '雾',
    heavyrain: '大雨', heavyrainandthunder: '大雨伴雷暴', heavyrainshowers: '强阵雨',
    heavyrainshowersandthunder: '强阵雨伴雷暴', heavysleet: '大雨夹雪', heavysleetandthunder: '大雨夹雪伴雷暴',
    heavysleetshowers: '强雨夹雪阵雨', heavysleetshowersandthunder: '强雨夹雪阵雨伴雷暴',
    heavysnow: '大雪', heavysnowandthunder: '大雪伴雷暴', heavysnowshowers: '强阵雪',
    heavysnowshowersandthunder: '强阵雪伴雷暴', lightrain: '小雨', lightrainandthunder: '小雨伴雷暴',
    lightrainshowers: '小阵雨', lightrainshowersandthunder: '小阵雨伴雷暴', lightsleet: '小雨夹雪',
    lightsleetandthunder: '小雨夹雪伴雷暴', lightsleetshowers: '小雨夹雪阵雨', lightsnow: '小雪',
    lightsnowandthunder: '小雪伴雷暴', lightsnowshowers: '小阵雪', partlycloudy: '局部多云',
    rain: '雨', rainandthunder: '雨伴雷暴', rainshowers: '阵雨', rainshowersandthunder: '阵雨伴雷暴',
    sleet: '雨夹雪', sleetandthunder: '雨夹雪伴雷暴', sleetshowers: '雨夹雪阵雨',
    sleetshowersandthunder: '雨夹雪阵雨伴雷暴', snow: '雪', snowandthunder: '雪伴雷暴',
    snowshowers: '阵雪', snowshowersandthunder: '阵雪伴雷暴',
};

class TimedCache {
    constructor(maxEntries = 8) {
        this.maxEntries = maxEntries;
        this.entries = new Map();
        this.failures = new Map();
        this.inFlight = new Map();
    }

    async read(key, ttlMs, loader, forceRefresh = false) {
        const now = Date.now();
        const entry = this.entries.get(key);
        if (!forceRefresh && entry && now - entry.fetchedAt < ttlMs) {
            return decorateCacheValue(entry.value, entry.fetchedAt, false, true);
        }

        const failure = this.failures.get(key);
        if (!forceRefresh && failure && now - failure.failedAt < ttlMs) {
            if (entry) {
                return decorateCacheValue(entry.value, entry.fetchedAt, true, true, failure.error);
            }
            throw new Error(failure.error);
        }

        if (this.inFlight.has(key)) {
            return this.inFlight.get(key);
        }

        const request = this.refresh(key, loader);
        this.inFlight.set(key, request);
        try {
            return await request;
        } finally {
            if (this.inFlight.get(key) === request) {
                this.inFlight.delete(key);
            }
        }
    }

    async refresh(key, loader) {
        try {
            const value = await loader();
            const fetchedAt = Date.now();
            this.entries.delete(key);
            this.entries.set(key, { value, fetchedAt });
            this.failures.delete(key);
            while (this.entries.size > this.maxEntries) {
                const oldestKey = this.entries.keys().next().value;
                this.entries.delete(oldestKey);
                this.failures.delete(oldestKey);
            }
            return decorateCacheValue(value, fetchedAt, false, false);
        } catch (error) {
            const errorText = safeError(error);
            this.failures.delete(key);
            this.failures.set(key, { failedAt: Date.now(), error: errorText });
            while (this.failures.size > this.maxEntries) {
                this.failures.delete(this.failures.keys().next().value);
            }
            const entry = this.entries.get(key);
            if (entry) {
                return decorateCacheValue(entry.value, entry.fetchedAt, true, true, errorText);
            }
            throw error;
        }
    }
}

function decorateCacheValue(value, fetchedAt, stale, cached, refreshError = '') {
    return {
        ...value,
        stale,
        cached,
        fetchedAt: new Date(fetchedAt).toISOString(),
        ageSeconds: Math.max(0, Math.round((Date.now() - fetchedAt) / 1000)),
        ...(refreshError ? { refreshError } : {}),
    };
}

function safeError(error) {
    const text = error instanceof Error ? error.message : String(error || '未知错误');
    return text.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 240);
}

function scalarQuery(value) {
    return Array.isArray(value) ? value[0] : value;
}

function queryString(value, fallback = '', maxLength = 160) {
    const raw = scalarQuery(value);
    if (raw === undefined || raw === null) return fallback;
    return String(raw).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, maxLength);
}

function queryBoolean(value, fallback) {
    const normalized = queryString(value, '', 8).toLowerCase();
    if (!normalized) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function queryInteger(value, minimum, maximum, fallback) {
    const text = queryString(value, '', 16);
    if (!text) return fallback;
    const number = Number(text);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
}

function finiteNumber(value, fieldName) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) {
        if (fieldName) throw new Error(`${fieldName} 不是有效数字`);
        return null;
    }
    return number;
}

function requireCoordinate(value, minimum, maximum, fieldName) {
    const number = finiteNumber(value, fieldName);
    if (number === null || number < minimum || number > maximum) {
        throw new Error(`${fieldName} 超出有效范围`);
    }
    return number;
}

function dedupeParts(parts) {
    return [...new Set(parts.map(part => queryString(part, '', 80)).filter(Boolean))];
}

function formatCoordinates(latitude, longitude) {
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function degreesToDirection(degrees) {
    const value = finiteNumber(degrees);
    if (value === null) return '';
    const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return directions[Math.round((((value % 360) + 360) % 360) / 45) % 8];
}

async function fetchJson(url, options = {}, fetchImpl = globalThis.fetch) {
    if (typeof fetchImpl !== 'function') throw new Error('当前浏览器没有 fetch');
    const { timeoutMs = HTTP_TIMEOUT_MS, ...fetchOptions } = options;
    let response;
    try {
        response = await fetchImpl(url, {
            ...fetchOptions,
            signal: AbortSignal.timeout(timeoutMs),
            headers: {
                Accept: 'application/json',
                ...(fetchOptions.headers || {}),
            },
        });
    } catch (error) {
        if (error?.name === 'TimeoutError' || /timed out|timeout/i.test(String(error?.message || error))) {
            throw new Error(`${url.hostname} 请求超过 ${Math.round(timeoutMs / 1000)} 秒`);
        }
        throw new Error(`${url.hostname} 请求失败：${safeError(error)}`);
    }
    if (!response.ok) throw new Error(`${url.hostname} 返回 HTTP ${response.status} ${response.statusText}`);
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_HTTP_BODY_BYTES) throw new Error('HTTP 响应过大');
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`HTTP 响应不是有效 JSON：${safeError(error)}`);
    }
}

async function geocodeManualLocation(name, requestJson) {
    if (!name) throw new Error('手动地点不能为空');
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', name);
    url.searchParams.set('count', '1');
    url.searchParams.set('language', 'zh');
    url.searchParams.set('format', 'json');
    const data = await requestJson(url);
    const result = data?.results?.[0];
    if (!result) throw new Error(`找不到地点“${name}”`);
    const latitude = requireCoordinate(result.latitude, -90, 90, 'latitude');
    const longitude = requireCoordinate(result.longitude, -180, 180, 'longitude');
    const parts = dedupeParts([result.name, result.admin1, result.country]);
    return {
        latitude,
        longitude,
        label: parts.join(' / ') || name,
        city: queryString(result.name, name, 80),
        region: queryString(result.admin1, '', 80),
        country: queryString(result.country, '', 80),
        timeZone: queryString(result.timezone, '', 80),
        accuracy: null,
        provider: 'manual',
    };
}

const REVERSE_GEOCODER_ORDER = ['nominatim', 'bigdatacloud', 'photon'];
const REVERSE_GEOCODER_NAMES = {
    nominatim: 'Nominatim',
    bigdatacloud: 'BigDataCloud',
    photon: 'Photon',
};

function makeAddress(provider, city, region, country, fallbackLabel = '') {
    const normalizedCity = queryString(city, '', 80);
    const normalizedRegion = queryString(region, '', 80);
    const normalizedCountry = queryString(country, '', 80);
    const parts = dedupeParts([normalizedCity, normalizedRegion, normalizedCountry]);
    const label = parts.join(' / ') || queryString(fallbackLabel, '', 160);
    if (!label) throw new Error(`${REVERSE_GEOCODER_NAMES[provider]} 没有返回有效地址`);
    return {
        label,
        city: normalizedCity,
        region: normalizedRegion,
        country: normalizedCountry,
        addressProvider: provider,
    };
}

async function reverseGeocodeNominatim(latitude, longitude, requestJson) {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', latitude.toFixed(6));
    url.searchParams.set('lon', longitude.toFixed(6));
    url.searchParams.set('zoom', '10');
    url.searchParams.set('accept-language', 'zh-CN,zh');
    const data = await requestJson(url, { timeoutMs: 5_000 });
    const address = data?.address || {};
    return makeAddress(
        'nominatim',
        address.city || address.town || address.village || address.municipality || address.county,
        address.state || address.province,
        address.country,
        data?.display_name,
    );
}

async function reverseGeocodeBigDataCloud(latitude, longitude, requestJson) {
    const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
    url.searchParams.set('latitude', latitude.toFixed(6));
    url.searchParams.set('longitude', longitude.toFixed(6));
    url.searchParams.set('localityLanguage', 'zh');
    const data = await requestJson(url, { timeoutMs: 5_000 });
    return makeAddress(
        'bigdatacloud',
        data?.locality || data?.city,
        data?.principalSubdivision,
        data?.countryName,
    );
}

async function reverseGeocodePhoton(latitude, longitude, requestJson) {
    const url = new URL('https://photon.komoot.io/reverse');
    url.searchParams.set('lat', latitude.toFixed(6));
    url.searchParams.set('lon', longitude.toFixed(6));
    const data = await requestJson(url, {
        timeoutMs: 5_000,
        headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.5' },
    });
    const properties = data?.features?.[0]?.properties || {};
    return makeAddress(
        'photon',
        properties.district || properties.city || properties.county,
        properties.state,
        properties.country,
        properties.name,
    );
}

async function reverseGeocode(provider, latitude, longitude, requestJson) {
    const loaders = {
        nominatim: reverseGeocodeNominatim,
        bigdatacloud: reverseGeocodeBigDataCloud,
        photon: reverseGeocodePhoton,
    };
    if (provider !== 'auto') {
        return loaders[provider](latitude, longitude, requestJson);
    }

    const failures = [];
    for (const candidate of REVERSE_GEOCODER_ORDER) {
        try {
            return {
                ...await loaders[candidate](latitude, longitude, requestJson),
                addressFallbackErrors: failures,
            };
        } catch (error) {
            failures.push(`${REVERSE_GEOCODER_NAMES[candidate]}：${safeError(error)}`);
        }
    }
    throw new Error(`所有反向地址解析服务均失败：${failures.join('；')}`);
}

function readBrowserLocation(rawQuery) {
    const latitude = requireCoordinate(rawQuery.latitude, -90, 90, 'latitude');
    const longitude = requireCoordinate(rawQuery.longitude, -180, 180, 'longitude');
    return {
        latitude,
        longitude,
        label: formatCoordinates(latitude, longitude),
        city: '',
        region: '',
        country: '',
        timeZone: '',
        accuracy: finiteNumber(rawQuery.accuracy),
        provider: 'browser-geolocation',
        timestamp: finiteNumber(rawQuery.locationTimestamp),
    };
}

async function fetchOpenMeteo(location, requestJson) {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', location.latitude.toFixed(6));
    url.searchParams.set('longitude', location.longitude.toFixed(6));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m');
    url.searchParams.set('temperature_unit', 'celsius');
    url.searchParams.set('wind_speed_unit', 'kmh');
    url.searchParams.set('timezone', 'auto');
    const data = await requestJson(url);
    const current = data?.current;
    if (!current) throw new Error('Open-Meteo 没有返回当前天气');
    return {
        condition: WMO_CONDITIONS_ZH[current.weather_code] || `天气代码 ${current.weather_code}`,
        temperature: finiteNumber(current.temperature_2m),
        feelsLike: finiteNumber(current.apparent_temperature),
        humidity: finiteNumber(current.relative_humidity_2m),
        windSpeed: finiteNumber(current.wind_speed_10m),
        windDirection: degreesToDirection(current.wind_direction_10m),
        timeZone: queryString(data.timezone, '', 80),
        source: 'Open-Meteo',
    };
}

function metCondition(symbolCode) {
    const base = queryString(symbolCode, '', 80).replace(/_(day|night|polartwilight)$/, '');
    return MET_CONDITIONS_ZH[base] || base || '未知';
}

async function fetchMetNorway(location, requestJson) {
    const url = new URL('https://api.met.no/weatherapi/locationforecast/2.0/complete');
    url.searchParams.set('lat', location.latitude.toFixed(4));
    url.searchParams.set('lon', location.longitude.toFixed(4));
    const data = await requestJson(url);
    const current = data?.properties?.timeseries?.[0];
    if (!current) throw new Error('MET Norway 没有返回当前天气');
    const details = current.data?.instant?.details || {};
    const summary = current.data?.next_1_hours?.summary || current.data?.next_6_hours?.summary || {};
    return {
        condition: metCondition(summary.symbol_code),
        temperature: finiteNumber(details.air_temperature),
        feelsLike: null,
        humidity: finiteNumber(details.relative_humidity),
        windSpeed: finiteNumber(details.wind_speed) === null ? null : finiteNumber(details.wind_speed) * 3.6,
        windDirection: degreesToDirection(details.wind_from_direction),
        timeZone: '',
        source: 'MET Norway',
    };
}

function wttrCondition(localized, weatherCode, english) {
    if (localized && /[\u3400-\u9fff]/u.test(localized)) return localized;
    const byCode = WTTR_WEATHER_CODES_ZH[Number(weatherCode)];
    return byCode || english || localized || '未知';
}

async function fetchWttr(location, requestJson) {
    const coordinates = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
    const url = new URL(`https://wttr.in/${coordinates}`);
    url.searchParams.set('format', 'j1');
    url.searchParams.set('lang', 'zh-cn');
    const data = await requestJson(url, { timeoutMs: 6_000 });
    const current = data?.current_condition?.[0];
    if (!current) throw new Error('wttr.in 没有返回当前天气');
    const localized = queryString(
        current['lang_zh-cn']?.[0]?.value || current.lang_zh?.[0]?.value || current.lang_xx?.[0]?.value,
        '',
        80
    );
    const english = queryString(current.weatherDesc?.[0]?.value, '', 80);
    return {
        condition: wttrCondition(localized, current.weatherCode, english),
        temperature: finiteNumber(current.temp_C),
        feelsLike: finiteNumber(current.FeelsLikeC),
        humidity: finiteNumber(current.humidity),
        windSpeed: finiteNumber(current.windspeedKmph),
        windDirection: queryString(current.winddir16Point, '', 24),
        timeZone: '',
        source: 'wttr.in',
    };
}

async function fetchWeather(provider, location, requestJson) {
    try {
        if (provider === 'open-meteo') return await fetchOpenMeteo(location, requestJson);
        if (provider === 'met-norway') return await fetchMetNorway(location, requestJson);
        if (provider === 'wttr.in') return await fetchWttr(location, requestJson);
        throw new Error(`不支持的天气提供方：${provider}`);
    } catch (error) {
        if (provider === 'open-meteo') throw error;
        const providerError = safeError(error);
        try {
            return {
                ...await fetchOpenMeteo(location, requestJson),
                fallbackFrom: provider,
                fallbackError: providerError,
            };
        } catch (fallbackError) {
            throw new Error(`${provider} 失败：${providerError}；Open-Meteo 回退也失败：${safeError(fallbackError)}`);
        }
    }
}

function createStatusService(dependencies = {}) {
    const requestJson = dependencies.requestJson || ((url, options) => fetchJson(url, options));
    const locationCache = new TimedCache();
    const addressCache = new TimedCache();
    const weatherCache = new TimedCache();

    return async function getStatus(rawQuery = {}) {
        const includeWeather = queryBoolean(rawQuery.weather, true);
        const forceRefresh = queryBoolean(rawQuery.force, false);
        const providerInput = queryString(rawQuery.provider, 'open-meteo', 32);
        const provider = PROVIDERS.has(providerInput) ? providerInput : 'open-meteo';
        const locationMode = queryString(rawQuery.locationMode, 'manual', 16) === 'auto' ? 'auto' : 'manual';
        const reverseProviderInput = queryString(rawQuery.reverseGeocodingProvider, 'auto', 32);
        const reverseGeocodingProvider = ['auto', ...REVERSE_GEOCODER_ORDER].includes(reverseProviderInput)
            ? reverseProviderInput
            : 'auto';
        const manualLocation = queryString(rawQuery.location, '', 160);
        const locationTtlMs = queryInteger(rawQuery.locationRefreshMinutes, 5, 60, 10) * 60_000;
        const weatherTtlMs = queryInteger(rawQuery.weatherRefreshMinutes, 5, 180, 30) * 60_000;
        const errors = {};
        const result = {
            ok: true,
            time: {
                iso: new Date().toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            },
            location: null,
            weather: null,
            errors,
            warnings: {},
            meta: { provider, locationMode, reverseGeocodingProvider, forceRefresh },
        };

        if (!includeWeather) {
            return result;
        }

        let browserLocation = null;
        if (locationMode === 'auto') {
            try {
                browserLocation = readBrowserLocation(rawQuery);
            } catch (error) {
                errors.location = safeError(error);
                result.ok = false;
                return result;
            }
        }
        const locationKey = locationMode === 'auto'
            ? `browser:${browserLocation.latitude.toFixed(4)},${browserLocation.longitude.toFixed(4)}`
            : `manual:${manualLocation.toLocaleLowerCase()}`;

        try {
            result.location = await locationCache.read(locationKey, locationTtlMs, () => (
                locationMode === 'auto'
                    ? Promise.resolve(browserLocation)
                    : geocodeManualLocation(manualLocation, requestJson)
            ), forceRefresh);
            if (result.location.stale && result.location.refreshError) {
                errors.location = result.location.refreshError;
            }
        } catch (error) {
            errors.location = safeError(error);
            result.ok = false;
            return result;
        }

        const coordinatesKey = `${result.location.latitude.toFixed(4)},${result.location.longitude.toFixed(4)}`;
        const addressKey = `${reverseGeocodingProvider}:${coordinatesKey}`;
        const weatherKey = `${provider}:${coordinatesKey}`;
        const followUpTasks = [];

        if (locationMode === 'auto') {
            followUpTasks.push((async () => {
                try {
                    const address = await addressCache.read(addressKey, locationTtlMs, () => (
                        reverseGeocode(
                            reverseGeocodingProvider,
                            result.location.latitude,
                            result.location.longitude,
                            requestJson,
                        )
                    ), forceRefresh);
                    result.location = {
                        ...result.location,
                        label: address.label || result.location.label,
                        city: address.city,
                        region: address.region,
                        country: address.country,
                        addressProvider: address.addressProvider,
                        addressStale: address.stale,
                    };
                    if (address.addressFallbackErrors?.length) {
                        result.warnings.location = `${address.addressFallbackErrors.join('；')}；已使用 ${REVERSE_GEOCODER_NAMES[address.addressProvider]}`;
                    } else if (address.stale && address.refreshError) {
                        result.warnings.location = `反向地址解析刷新失败（${address.refreshError}），正在使用旧地址缓存`;
                    }
                } catch (error) {
                    result.warnings.location = `反向地址解析失败（${reverseGeocodingProvider === 'auto' ? '自动' : REVERSE_GEOCODER_NAMES[reverseGeocodingProvider]}）：${safeError(error)}；保留坐标`;
                }
            })());
        }

        followUpTasks.push((async () => {
            try {
                result.weather = await weatherCache.read(weatherKey, weatherTtlMs, () => (
                    fetchWeather(provider, result.location, requestJson)
                ), forceRefresh);
                if (result.weather.stale && result.weather.refreshError) {
                    errors.weather = result.weather.refreshError;
                }
                if (result.weather.fallbackFrom) {
                    result.warnings.weather = `${result.weather.fallbackFrom} 暂不可用（${result.weather.fallbackError}），已回退到 Open-Meteo`;
                }
                if (result.weather.timeZone) result.time.timeZone = result.weather.timeZone;
                else if (result.location.timeZone) result.time.timeZone = result.location.timeZone;
            } catch (error) {
                errors.weather = safeError(error);
            }
        })());

        await Promise.all(followUpTasks);
        result.ok = Object.keys(errors).length === 0;
        return result;
    };
}

export {
    TimedCache,
    WTTR_WEATHER_CODES_ZH,
    createStatusService,
    degreesToDirection,
    readBrowserLocation,
    safeError,
    wttrCondition,
};
