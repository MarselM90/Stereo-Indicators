(() => {
  const CONFIG = {
    audio: {
      minThreshold: 0.2,
      maxModulationLevel: 0.9,
      riseRate: 1.4,
      amplification: 0.67,
      bassReduction: -2,
      highPassCutoff: 1200,
      lowPassCutoff: 2000, 
      smoothing: 0.85
    },
    display: {
      colors: {
        low: 'hsl(120, 100%, 50%)',
        mid: 'hsl(60, 100%, 50%)',
        high: 'hsl(0, 100%, 50%)',
        peak: '#ffffff',
        text: 'inherit',
        bg: 'inherit',
        title: 'inherit',
        scale: 'rgba(255,255,255,0.6)'
      },
      dimensions: {
        containerWidth: '50%',
        containerHeight: 123,
        barHeight: 20,
        spacing: 10,
        headerHeight: 0,
        contentTop: 40,
        labelLeft: 5,
        canvasLeft: 25,
        borderRadius: '18px',
        scaleFontSize: '12px'
      },
      defaultTitle: ''
    }
  };

  const SMOOTHING_FACTOR = 0.4;

  function getStoredColor() {
    return localStorage.getItem('stereoPeakmeterColor') || CONFIG.display.colors.title;
  }
  function storeColor(color) {
    localStorage.setItem('stereoPeakmeterColor', color);
  }
  function getStoredBgColor() {
    return localStorage.getItem('stereoPeakmeterBgColor') || CONFIG.display.colors.bg;
  }
  function storeBgColor(color) {
    localStorage.setItem('stereoPeakmeterBgColor', color);
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) return;

  const STATE = {
    audio: {
      context: null,
      splitter: null,
      analyserLeft: null,
      analyserRight: null,
      bassFilter: null,
      highPassFilter: null,
      lowPassFilter: null, 
      source: null
    },
    levels: {
      left: { current: 0, peak: 0 },
      right: { current: 0, peak: 0 }
    },
    dom: {
      container: null,
      canvas: null,
      ctx: null,
      labels: { left: null, right: null },
      scales: { left: null, right: null }
    },
    peakTimeout: null
  };

  function createLabel(text, top) {
    const label = document.createElement('div');
    label.textContent = text;
    label.style.cssText = `
      position: absolute;
      left: ${CONFIG.display.dimensions.labelLeft}px;
      top: ${top + (CONFIG.display.dimensions.barHeight / 2) - 6}px;
      color: ${CONFIG.display.colors.text};
      font: bold 9px Arial;
      z-index: 2;
      text-shadow: 1px 1px 2px black;
    `;
    STATE.dom.container.appendChild(label);
    return label;
  }

  function createScale(scaleText, top) {
    const scale = document.createElement('div');
    scale.textContent = scaleText;
    scale.style.cssText = `
      position: absolute;
      left: 20px;
      top: ${top}px;
      width: calc(100% - 20px);
      color: #ffffff;
      font: normal ${CONFIG.display.dimensions.scaleFontSize} Arial, sans-serif;
      text-align: center;
      letter-spacing: 3px;
      user-select: none;
      opacity: 0.99;
    `;
    STATE.dom.container.appendChild(scale);
    return scale;
  }

  function applySkinColors() {
    const rootElement = document.querySelector('#main-container') || document.body;
    const styles = getComputedStyle(rootElement);

    const skinColors = {
      bg: styles.backgroundColor || getStoredBgColor(),
      text: styles.color || CONFIG.display.colors.text,
      accent: styles.getPropertyValue('--accent-color')?.trim() ||
              document.querySelector('a')?.style.color ||
              getStoredColor()
    };

    CONFIG.display.colors = {
      ...CONFIG.display.colors,
      text: skinColors.text,
      bg: skinColors.bg,
      title: skinColors.accent,
      scale: `${skinColors.text}80`,
      peak: skinColors.text
    };

    if (STATE.dom.container) {
      STATE.dom.container.style.background = skinColors.bg;
      storeBgColor(skinColors.bg);
    }
    if (STATE.dom.labels.left && STATE.dom.labels.right) {
      STATE.dom.labels.left.style.color = skinColors.text;
      STATE.dom.labels.right.style.color = skinColors.text;
    }
    if (STATE.dom.scales.left && STATE.dom.scales.right) {
      STATE.dom.scales.left.style.color = `${skinColors.text}80`;
      STATE.dom.scales.right.style.color = `${skinColors.text}80`;
    }
  }

  document.addEventListener("DOMContentLoaded", function() {
    CONFIG.display.colors.bg = getStoredBgColor();
    CONFIG.display.colors.title = getStoredColor();

    STATE.dom.container = document.createElement('div');
    STATE.dom.container.className = 'panel-33';
    STATE.dom.container.id = 'stereo-indicators-container';
    STATE.dom.container.style.cssText = `
      width: ${CONFIG.display.dimensions.containerWidth};
      height: ${CONFIG.display.dimensions.containerHeight}px;
      position: relative;
      background: ${CONFIG.display.colors.bg};
      border-radius: ${CONFIG.display.dimensions.borderRadius};
      margin-top: 19px;
      overflow: hidden;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;

    STATE.dom.canvas = document.createElement('canvas');
    STATE.dom.canvas.id = 'stereo-audiometer-canvas';
    STATE.dom.canvas.style.cssText = `
      position: absolute;
      width: calc(100% - ${CONFIG.display.dimensions.canvasLeft + 5}px);
      height: ${CONFIG.display.dimensions.barHeight * 2 + CONFIG.display.dimensions.spacing}px;
      top: ${CONFIG.display.dimensions.contentTop}px;
      left: ${CONFIG.display.dimensions.canvasLeft}px;
      background: transparent;
    `;
    STATE.dom.container.appendChild(STATE.dom.canvas);

    STATE.dom.labels.left = createLabel('L', CONFIG.display.dimensions.contentTop);
    STATE.dom.labels.right = createLabel('R', CONFIG.display.dimensions.contentTop + CONFIG.display.dimensions.barHeight + CONFIG.display.dimensions.spacing);

    const scaleValues = "-40 -30 -20 -10 -5 -3 -1 0 +1 +3";
    STATE.dom.scales.left = createScale(scaleValues, CONFIG.display.dimensions.contentTop - 15);
    STATE.dom.scales.right = createScale(scaleValues, CONFIG.display.dimensions.contentTop + CONFIG.display.dimensions.barHeight * 2 + CONFIG.display.dimensions.spacing + 3);

    const targetDiv = document.getElementById('freq-container')?.nextElementSibling;
    if (targetDiv) {
      targetDiv.parentNode.insertBefore(STATE.dom.container, targetDiv.nextSibling);
    } else {
      document.body.appendChild(STATE.dom.container);
    }

    new MutationObserver(() => {
      applySkinColors();
    }).observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      subtree: true
    });

    applySkinColors();
    initAudioSystem();

    let lastAudioNode = null;

    setInterval(() => {
      if (
        typeof Stream !== 'undefined' &&
        Stream?.Fallback?.Player?.Amplification &&
        Stream?.Fallback?.Audio
      ) {
        const currentNode = Stream.Fallback.Player.Amplification;

        if (currentNode !== lastAudioNode) {
          console.log('[INFO] Stream audio...');
          lastAudioNode = currentNode;
          resetAudioState();
          initAudioSystem();
        }
      }
    }, 1000);
  });

  function resetAudioState() {
    STATE.audio = {
      context: null,
      splitter: null,
      analyserLeft: null,
      analyserRight: null,
      bassFilter: null,
      highPassFilter: null,
      lowPassFilter: null,
      source: null
    };
  }

  function initAudioSystem() {
    if (typeof Stream !== 'undefined' && Stream?.Fallback?.Player && Stream?.Fallback?.Audio) {
      if (STATE.audio.context == null) {
        STATE.audio.context = Stream.Fallback.Audio;
        STATE.audio.source = Stream.Fallback.Player.Amplification;
      }

      STATE.audio.splitter = STATE.audio.context.createChannelSplitter(2);
      STATE.audio.analyserLeft = STATE.audio.context.createAnalyser();
      STATE.audio.analyserRight = STATE.audio.context.createAnalyser();
      STATE.audio.analyserLeft.fftSize = 256;
      STATE.audio.analyserRight.fftSize = 256;

      STATE.audio.bassFilter = STATE.audio.context.createBiquadFilter();
      STATE.audio.bassFilter.type = 'lowshelf';
      STATE.audio.bassFilter.frequency.value = 200;
      STATE.audio.bassFilter.gain.value = CONFIG.audio.bassReduction;

      STATE.audio.highPassFilter = STATE.audio.context.createBiquadFilter();
      STATE.audio.highPassFilter.type = 'highpass';
      STATE.audio.highPassFilter.frequency.value = CONFIG.audio.highPassCutoff;

      STATE.audio.lowPassFilter = STATE.audio.context.createBiquadFilter();
      STATE.audio.lowPassFilter.type = 'lowpass';
      STATE.audio.lowPassFilter.frequency.value = CONFIG.audio.lowPassCutoff;

      STATE.audio.source
        .connect(STATE.audio.bassFilter)
        .connect(STATE.audio.highPassFilter)
        .connect(STATE.audio.lowPassFilter)
        .connect(STATE.audio.splitter);

      STATE.audio.splitter.connect(STATE.audio.analyserLeft, 0);
      STATE.audio.splitter.connect(STATE.audio.analyserRight, 1);

      startRendering();
    } else {
      setTimeout(initAudioSystem, 500);
    }
  }

  function startRendering() {
    STATE.dom.canvas.width = STATE.dom.canvas.offsetWidth;
    STATE.dom.canvas.height = STATE.dom.canvas.offsetHeight;
    STATE.dom.ctx = STATE.dom.canvas.getContext('2d');
    requestAnimationFrame(updateMeters);
  }

  function updateMeters() {
    if (!STATE.audio.analyserLeft || !STATE.audio.analyserRight) {
      requestAnimationFrame(updateMeters);
      return;
    }

    const dataLeft = new Uint8Array(STATE.audio.analyserLeft.frequencyBinCount);
    const dataRight = new Uint8Array(STATE.audio.analyserRight.frequencyBinCount);
    STATE.audio.analyserLeft.getByteFrequencyData(dataLeft);
    STATE.audio.analyserRight.getByteFrequencyData(dataRight);

    STATE.levels.left.current = processChannel(dataLeft, STATE.levels.left.current);
    STATE.levels.left.peak = updatePeak(STATE.levels.left.current, STATE.levels.left.peak);

    STATE.levels.right.current = processChannel(dataRight, STATE.levels.right.current);
    STATE.levels.right.peak = updatePeak(STATE.levels.right.current, STATE.levels.right.peak);

    renderMeters();
    requestAnimationFrame(updateMeters);
  }

  function processChannel(data, previousLevel) {
    const rawLevel = data.reduce((a, b) => a + b, 0) / data.length;
    if (rawLevel < CONFIG.audio.minThreshold) return 0;
    const shaped = Math.pow(rawLevel * CONFIG.audio.amplification, CONFIG.audio.riseRate);
    const level = Math.min(shaped, 255);
    return SMOOTHING_FACTOR * previousLevel + (1 - SMOOTHING_FACTOR) * level;
  }

  function updatePeak(current, peak) {
    if (current > peak) {
      clearTimeout(STATE.peakTimeout);
      STATE.peakTimeout = setTimeout(() => {
        STATE.levels.left.peak = 0;
        STATE.levels.right.peak = 0;
      }, 1000);
      return current;
    }
    return peak * CONFIG.audio.smoothing;
  }

  function renderMeters() {
    const ctx = STATE.dom.ctx;
    const width = STATE.dom.canvas.width;
    const height = CONFIG.display.dimensions.barHeight;

    ctx.clearRect(0, 0, width, STATE.dom.canvas.height);

    renderChannel(STATE.levels.left.current, STATE.levels.left.peak, 0, width, height);
    renderChannel(STATE.levels.right.current, STATE.levels.right.peak, height + CONFIG.display.dimensions.spacing, width, height);
  }

  function renderChannel(level, peak, y, width, height) {
    const ctx = STATE.dom.ctx;
    const levelWidth = (level / 255) * width;

    const gradient = ctx.createLinearGradient(0, y, width, y + height);
    gradient.addColorStop(0, CONFIG.display.colors.low);
    gradient.addColorStop(0.45, CONFIG.display.colors.mid);
    gradient.addColorStop(0.77, CONFIG.display.colors.high);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, levelWidth, height);

    ctx.fillStyle = CONFIG.display.colors.peak;
    ctx.fillRect(peak / 255 * width, y, 2, height);
  }
})();
