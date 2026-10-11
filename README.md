# Sistema Web Interno - Veterinaria VetSalud 🐾
> Control de Inventarios, Registro de Ventas y Verificación de Prescripciones Médicas.

Sistema desarrollado para la gestión operativa y administrativa de clínicas veterinarias, cumpliendo con los requerimientos funcionales RF-01 al RF-16 basados en la metodología UWE.

---

## 🛠️ Tecnologías Utilizadas
- **Backend:** Node.js, Express, Prisma ORM 7 (Driver MariaDB/MySQL).
- **Base de Datos:** MySQL / MariaDB (`veterinaria_db`).
- **Frontend:** HTML5, Vanilla CSS (Diseño moderno, modo oscuro/claro, responsive), JavaScript Vanilla y Chart.js.
- **Seguridad:** Autenticación JWT, contraseñas encriptadas con bcryptjs y roles de acceso.

---

## 🚀 Guía de Instalación y Ejecución Rápida (Para el Equipo)

Si acabas de clonar el repositorio, sigue estos pasos para poner a funcionar el sistema en tu PC:

### 1. Clonar el repositorio y situarse en la rama `develop`:
```bash
git clone https://github.com/ManuelGm003/veterinaria-sistema-web.git
cd veterinaria-sistema-web
git checkout develop
```

### 2. Instalar dependencias del Backend:
```bash
cd backend-node
npm install
```

### 3. Configurar las variables de entorno (`.env`):
Copia el archivo `.env.example` y renómbralo a `.env`:
```bash
cp .env.example .env
```
*(Verifica que los datos de conexión a tu MySQL local coincidan con tu usuario y contraseña de XAMPP/WAMP o MySQL Server)*.

### 4. Sincronizar la Base de Datos con Prisma y Cargar Datos Iniciales:
Asegúrate de que el servicio MySQL esté corriendo (ej. en XAMPP) y ejecuta:
```bash
# Crear todas las tablas en MySQL automáticamente
npx prisma db push

# Cargar roles, usuarios (admin, cajero, bodeguero), productos, lotes y recetas de prueba
node prisma/seed.js
```

### 5. Iniciar el Servidor:
```bash
node src/index.js
```

Abre tu navegador en:  
👉 **[http://localhost:4000/](http://localhost:4000/)**

---

## 🔑 Credenciales de Acceso para Pruebas (Seed)

| Rol | Correo | Contraseña | Permisos Principales |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@veterinaria.com` | `admin123` | Acceso total al sistema, reportes, usuarios y configuración. |
| **Cajero** | `cajero@veterinaria.com` | `cajero123` | Punto de Venta (POS), validación de recetas (RF-13) y emisión de tickets. |
| **Bodeguero** | `bodeguero@veterinaria.com` | `bodeguero123` | Inventario, lotes, vencimientos y recepción de mercadería (RF-06, RF-09). |

---

## 🛡️ Reglas de Oro para Trabajar en Equipo (¡Evita Dañar el Sistema!)

Para que ningún compañero sobreescriba o rompa el trabajo de los demás, sigan estas buenas prácticas de Git:

1. **Nunca trabajen directamente sobre `main`:**
   - La rama `main` es solo para versiones finales estables.
   - La rama de desarrollo en equipo es **`develop`**.

2. **Crea siempre tu propia rama para cada cambio o pantalla:**
   Antes de programar algo nuevo, saca tu rama desde `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/mi-nueva-pantalla
   ```

3. **Antes de subir tus cambios (`push`), haz `pull`:**
   ```bash
   git checkout develop
   git pull origin develop
   ```

4. **Si trabajaron en ramas separadas, creen un Pull Request (PR) en GitHub:**
   - De esa manera, GitHub les avisa si hay algún conflicto antes de fusionar el código y nadie borra accidentalmente el trabajo de otro.