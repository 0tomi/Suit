export function captureVideoPoster(url) {
    if (!url || typeof document === 'undefined') {
        return Promise.resolve({
            poster: null,
            width: 16,
            height: 9,
        });
    }

    return new Promise((resolve) => {
        const video = document.createElement('video');
        let resolved = false;
        let timeoutId = null;
        let shouldWaitForSeek = false;

        const settle = (result) => {
            if (resolved) {
                return;
            }

            resolved = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            video.pause();
            video.removeAttribute('src');
            video.load();

            resolve(result);
        };

        const getFallbackDimensions = () => ({
            width: video.videoWidth || 16,
            height: video.videoHeight || 9,
        });

        const captureFrame = () => {
            const { width, height } = getFallbackDimensions();
            if (!video.videoWidth || !video.videoHeight) {
                settle({ poster: null, width, height });
                return;
            }

            try {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d');

                if (!context) {
                    settle({ poster: null, width, height });
                    return;
                }

                context.drawImage(video, 0, 0, width, height);
                settle({
                    poster: canvas.toDataURL('image/jpeg', 0.82),
                    width,
                    height,
                });
            } catch {
                settle({ poster: null, width, height });
            }
        };

        const handleLoadedData = () => {
            const duration = Number(video.duration);
            const hasSeekableFrame = Number.isFinite(duration) && duration > 0.25;

            if (!shouldWaitForSeek && hasSeekableFrame) {
                shouldWaitForSeek = true;
                try {
                    video.currentTime = Math.min(0.25, Math.max(duration / 10, 0.05));
                    return;
                } catch {
                    shouldWaitForSeek = false;
                }
            }

            captureFrame();
        };

        video.addEventListener('loadeddata', handleLoadedData, { once: true });
        video.addEventListener('seeked', captureFrame, { once: true });
        video.addEventListener('error', () => {
            settle({
                poster: null,
                ...getFallbackDimensions(),
            });
        }, { once: true });

        timeoutId = setTimeout(() => {
            settle({
                poster: null,
                ...getFallbackDimensions(),
            });
        }, 4000);

        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.src = url;
        video.load();
    });
}
