<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title ?? 'Subir Archivo - Suit' }}</title>
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
            --success: #22c55e;
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

        .upload-area {
            border: 2px dashed var(--border);
            border-radius: 16px;
            padding: 40px 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            background: #fbfcfe;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }

        .upload-area:hover, .upload-area.dragover {
            border-color: var(--primary);
            background: #f0f7ff;
        }

        .upload-icon {
            font-size: 48px;
            margin-bottom: 12px;
            display: block;
        }

        input[type="file"] {
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            opacity: 0;
            cursor: pointer;
        }

        .file-info {
            margin-top: 16px;
            font-size: 0.9rem;
            color: var(--primary);
            font-weight: 500;
            display: none;
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
            margin-top: 24px;
            transition: background-color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn:hover {
            background-color: var(--primary-hover);
        }

        .btn:disabled {
            background-color: var(--border);
            cursor: not-allowed;
        }

        .alert {
            margin-top: 24px;
            padding: 16px;
            border-radius: 12px;
            font-size: 0.9rem;
            display: none;
        }

        .alert-success {
            background-color: #f0fdf4;
            color: var(--success);
            border: 1px solid #bbf7d0;
        }

        .alert-error {
            background-color: #fef2f2;
            color: var(--error);
            border: 1px solid #fecaca;
        }

        .loader {
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
            display: none;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
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
        <h1><span style="color: var(--primary)">{{ $title ?? 'Subir Archivo' }}</span></h1>
        <p>{{ $description ?? 'Selecciona el archivo que deseas cargar en el sistema.' }}</p>

        @if(isset($allowed_formats))
            <div style="margin-top: -24px; margin-bottom: 24px; font-size: 0.85rem; color: var(--text-muted); padding: 8px 16px; background: rgba(0,0,0,0.03); border-radius: 20px; display: inline-block;">
                Formatos: <strong>{{ $allowed_formats }}</strong>
            </div>
        @endif

        <form id="uploadForm" enctype="multipart/form-data">
            <div class="upload-area" id="uploadArea">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 48px; height: 48px; margin-bottom: 12px; color: #94a3b8;">
                    <path d="M4 14.8995V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V14.8995M12 3V15.5M12 3L8 7M12 3L16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span id="uploadText">Toca para seleccionar</span>
                <input type="file" name="files[]" id="fileInput" required accept="{{ $accept ?? '*' }}" multiple>
                <div class="file-info" id="fileInfo" style="text-align: left; max-height: 150px; overflow-y: auto; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.03); margin-top: 12px; width: 100%;"></div>
            </div>

            <button type="submit" class="btn" id="submitBtn">
                <span class="loader" id="loader"></span>
                <span id="btnText">Empezar subida</span>
            </button>
        </form>

        <div id="alertSuccess" class="alert alert-success">
            <strong>✅ ¡Éxito!</strong> <span id="successMessage">Los archivos se han subido correctamente.</span>
        </div>
        <div id="alertError" class="alert alert-error">
            <strong>❌ Error:</strong> <span id="errorMessage">No se pudo subir el archivo.</span>
        </div>
    </div>

    <script>
        const form = document.getElementById('uploadForm');
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const uploadText = document.getElementById('uploadText');
        const submitBtn = document.getElementById('submitBtn');
        const loader = document.getElementById('loader');
        const btnText = document.getElementById('btnText');
        const alertSuccess = document.getElementById('alertSuccess');
        const alertError = document.getElementById('alertError');
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');

        fileInput.addEventListener('change', (e) => {
            const files = fileInput.files;
            if (files.length > 0) {
                fileInfo.innerHTML = '';
                let totalSize = 0;
                
                Array.from(files).forEach(file => {
                    const fileSize = (file.size / 1024 / 1024).toFixed(2);
                    totalSize += file.size;
                    const div = document.createElement('div');
                    div.style.marginBottom = '4px';
                    div.style.fontSize = '0.85rem';
                    div.style.display = 'flex';
                    div.style.justifyContent = 'space-between';
                    div.innerHTML = `<span>${file.name}</span> <span style="color: var(--text-muted)">${fileSize} MB</span>`;
                    fileInfo.appendChild(div);
                });

                fileInfo.style.display = 'block';
                uploadText.textContent = files.length === 1 
                    ? '1 archivo seleccionado' 
                    : `${files.length} archivos seleccionados`;
            } else {
                fileInfo.style.display = 'none';
                uploadText.textContent = 'Toca para seleccionar';
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Reset UI
            alertSuccess.style.display = 'none';
            alertError.style.display = 'none';
            submitBtn.disabled = true;
            loader.style.display = 'block';
            btnText.textContent = 'Subiendo...';

            const formData = new FormData(form);
            
            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                const result = await response.json();

                if (response.ok) {
                    alertSuccess.style.display = 'block';
                    form.style.display = 'none';
                    const count = fileInput.files.length;
                    successMessage.textContent = count === 1 
                        ? 'El archivo se ha subido correctamente.' 
                        : `Se han subido ${count} archivos correctamente.`;
                    btnText.textContent = 'Completado';
                } else {
                    throw new Error(result.message || 'Error al subir los archivos.');
                }
            } catch (error) {
                alertError.style.display = 'block';
                errorMessage.textContent = error.message;
                submitBtn.disabled = false;
                loader.style.display = 'none';
                btnText.textContent = 'Reintentar subida';
            }
        });

        // Add visual feedback for touch on mobile
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('touchstart', () => {
            uploadArea.style.transform = 'scale(0.98)';
        });
        uploadArea.addEventListener('touchend', () => {
            uploadArea.style.transform = 'scale(1)';
        });
    </script>
</body>
</html>
