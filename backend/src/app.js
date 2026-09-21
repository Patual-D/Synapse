const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const assetRoutes = require('./routes/asset.routes');
const reservationRoutes = require('./routes/reservation.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'synapse-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/maintenance', maintenanceRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;