<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title ?? 'Descargar Archivo - Suit' }}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            @if(($context ?? '') === 'multimedia')
                --primary: #15803d;
                --primary-hover: #166534;
            @elseif(($context ?? '') === 'file')
                --primary: #b91c1c;
                --primary-hover: #991b1b;
            @else
                --primary: #1e3a8a;
                --primary-hover: #1e40af;
            @endif
            --bg: #f8fafc;
            --card-bg: #ffffff;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --border: #e2e8f0;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            width: 100%;
            max-width: 450px;
            background: var(--card-bg);
            border-radius: 24px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
            padding: 40px 32px;
            text-align: center;
            border: 1px solid var(--border);
        }

        .logo {
            width: 120px;
            margin-bottom: 24px;
        }

        h1 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 8px;
            color: var(--text-main);
        }

        p {
            color: var(--text-muted);
            font-size: 0.95rem;
            margin-bottom: 32px;
            line-height: 1.5;
        }

        .file-card {
            background: #fbfcfe;
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 32px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
        }

        .file-icon {
            width: 64px;
            height: 64px;
            background: rgba(0, 0, 0, 0.03);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--primary);
        }

        .file-name {
            font-weight: 600;
            font-size: 1.1rem;
            color: var(--text-main);
            word-break: break-all;
        }

        .file-meta {
            font-size: 0.85rem;
            color: var(--text-muted);
        }

        .btn {
            background-color: var(--primary);
            color: white;
            border: none;
            padding: 14px 28px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
        }

        .btn:hover {
            background-color: var(--primary-hover);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .btn:active {
            transform: translateY(0);
        }

        @media (max-width: 480px) {
            .container {
                padding: 32px 24px;
                border-radius: 0;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                border: none;
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="{{ asset('assets/logo.png') }}" alt="Suit Logo" class="logo">
        <h1><span style="color: var(--primary)">{{ $title ?? 'Descargar Archivo' }}</span></h1>
        <p>{{ $description ?? 'Tu archivo está listo para descargar.' }}</p>

        <div class="file-card">
            <div class="file-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px;">
                    <path d="M7 18H17V16H7V18ZM7 14H17V12H7V14ZM7 10H13V8H7V10ZM14 2H6C4.89 2 4 2.9 4 4V20C4 21.1 4.89 22 6 22H18C19.11 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z" fill="currentColor"/>
                </svg>
            </div>
            <div class="file-name">{{ $filename ?? 'Archivo sin nombre' }}</div>
            <div class="file-meta">{{ $filesize ?? '' }}</div>
        </div>

        <a href="{{ request()->fullUrlWithQuery(['confirmed' => 1]) }}" class="btn">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                <path d="M12 16L7 11L8.4 9.55L11 12.15V4H13V12.15L15.6 9.55L17 11L12 16ZM6 20C5.45 20 4.97917 19.8042 4.5875 19.4125C4.19583 19.0208 4 18.55 4 18V15H6V18H18V15H20V18C20 18.55 19.8042 19.0208 19.4125 19.4125C19.0208 19.8042 18.55 20 18 20H6Z" fill="currentColor"/>
            </svg>
            <span>Descargar Archivo</span>
        </a>
    </div>
</body>
</html>
