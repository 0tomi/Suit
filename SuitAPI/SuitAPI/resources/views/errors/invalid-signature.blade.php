<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enlace no válido - Suit</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #1e3a8a;
            --bg: #f8fafc;
            --card-bg: #ffffff;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --error: #ef4444;
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
            padding: 40px 32px;
            text-align: center;
            border: 1px solid var(--border);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
        }

        .logo {
            width: 100px;
            margin-bottom: 24px;
        }

        .error-icon {
            font-size: 64px;
            margin-bottom: 24px;
            display: block;
        }

        h1 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 12px;
            color: var(--text-main);
        }

        p {
            color: var(--text-muted);
            font-size: 1rem;
            line-height: 1.6;
            margin-bottom: 32px;
        }

        .btn {
            background-color: var(--primary);
            color: white;
            padding: 14px 28px;
            border-radius: 12px;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: opacity 0.2s;
        }

        .btn:hover {
            opacity: 0.9;
        }

        @media (max-width: 480px) {
            .container {
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
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 64px; height: 64px; margin-bottom: 24px; color: #ef4444; margin-left: auto; margin-right: auto; display: block;">
            <path d="M12 9V14M12 17.01L12.01 16.9989M10.29 3.86L1.82 18C1.64537 18.3024 1.55299 18.645 1.55219 18.9935C1.55139 19.342 1.64215 19.6852 1.81522 19.9882C1.98829 20.2912 2.23783 20.5435 2.53851 20.7196C2.8392 20.8957 3.18121 20.9889 3.53 20.99H20.47C20.8188 20.9889 21.1608 20.8957 21.4615 20.7196C21.7622 20.5435 22.0117 20.2912 22.1848 19.9882C22.3579 19.6852 22.4486 19.342 22.4478 18.9935C22.447 18.645 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32319 12.9812 3.15445C12.6817 2.9857 12.3438 2.89722 12 2.89722C11.6562 2.89722 11.3183 2.9857 11.0188 3.15445C10.7193 3.32319 10.4683 3.56611 10.29 3.86V3.86Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h1>Enlace no válido o expirado</h1>
        <p>Lo sentimos, ocurrió un problema con el enlace o este ya ha expirado. Por favor, vuelve a generar el link desde la aplicación e intenta nuevamente.</p>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Error: Invalid Signature</span>
    </div>
</body>
</html>
