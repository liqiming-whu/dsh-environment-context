function clean(value, maxLength = 80) {
    return String(value ?? '')
        .replace(/[\u0000-\u001f\u007f<>]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

export function detectPlatform({ userAgent = '', platform = '', userAgentData = null } = {}) {
    const hinted = clean(userAgentData?.platform, 40).toLowerCase();
    const text = `${hinted} ${userAgent} ${platform}`.toLowerCase();
    if (hinted === 'android' || /\bandroid\b/.test(text)) return 'Android';
    if (hinted === 'ios' || /\b(iphone|ipad|ipod)\b/.test(text)) return 'iOS';
    if (hinted === 'macos' || /\b(macintosh|mac os x|macintel)\b/.test(text)) return 'macOS';
    if (hinted === 'windows' || /\b(windows|win32|win64)\b/.test(text)) return 'Windows';
    if (hinted === 'chrome os' || /\b(cros)\b/.test(text)) return 'ChromeOS';
    if (hinted === 'linux' || /\b(linux|x11)\b/.test(text)) return 'Linux';
    return clean(userAgentData?.platform || platform, 40) || '未知平台';
}

export function detectModel({ userAgent = '', highEntropy = null } = {}) {
    const hinted = clean(highEntropy?.model, 80);
    if (hinted) return hinted;

    const android = String(userAgent).match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/i);
    if (android) {
        const candidate = clean(android[1].replace(/\s+wv$/i, ''), 80);
        if (candidate && !/^(zh[-_]|en[-_]|[a-z]{2}[-_][A-Z]{2}$)/.test(candidate)) return candidate;
    }
    if (/\biPad\b/i.test(userAgent)) return 'iPad';
    if (/\biPhone\b/i.test(userAgent)) return 'iPhone';
    if (/\biPod\b/i.test(userAgent)) return 'iPod';
    return '';
}

export async function readBrowserDevice(navigatorObject = globalThis.navigator) {
    const nav = navigatorObject || {};
    const userAgentData = nav.userAgentData || null;
    let highEntropy = null;
    if (typeof userAgentData?.getHighEntropyValues === 'function') {
        try {
            highEntropy = await userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion', 'architecture', 'bitness']);
        } catch (error) {
            console.warn('[环境上下文] 读取 User-Agent Client Hints 失败', error);
        }
    }
    const source = {
        userAgent: clean(nav.userAgent, 500),
        platform: clean(nav.platform, 80),
        userAgentData,
        highEntropy,
    };
    return {
        name: '',
        model: detectModel(source),
        platform: detectPlatform(source),
        source: userAgentData ? 'user-agent-client-hints' : 'user-agent',
    };
}
