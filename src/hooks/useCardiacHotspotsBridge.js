import { useCallback, useEffect } from 'react';
import { hasReportHotspots, isCardiacScenario } from '../lib/cardiacScenario.js';

const emptyInterpretability = { hotspots: [] };

export function useCardiacHotspotsBridge(iframeRef, visualization) {
  const sendToViewer = useCallback(() => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow || !visualization) return;

    const { id, interpretability = emptyInterpretability, visualScenario } = visualization;
    const origin = window.location.origin;
    frameWindow.postMessage({
      type: 'AIRSTARK_SHOW_HOTSPOTS',
      id: `${id}:report`,
      interpretability,
    }, origin);

    if (!hasReportHotspots(interpretability) && isCardiacScenario(visualScenario)) {
      frameWindow.postMessage({
        type: 'AIRSTARK_SHOW_SCENARIO',
        id: `${id}:demo`,
        visualScenario,
      }, origin);
    }
  }, [iframeRef, visualization]);

  useEffect(() => {
    function onViewerReady(event) {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === 'AIRSTARK_HOTSPOTS_READY') sendToViewer();
    }

    window.addEventListener('message', onViewerReady);
    sendToViewer();
    return () => window.removeEventListener('message', onViewerReady);
  }, [iframeRef, sendToViewer]);

  return sendToViewer;
}
