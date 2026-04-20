/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './components/auth/LoginPage';
import { NewTradeClient } from './components/trade/NewTradeClient';
import { DashboardClient } from './components/dashboard/DashboardClient';
import { TradeDetailClient } from './components/trade/TradeDetailClient';
import { TradeHistoryClient } from './components/trade/TradeHistoryClient';
import { MetricsEditorClient } from './components/settings/MetricsEditorClient';
import { ProfileSettingsClient } from './components/settings/ProfileSettingsClient';
import { PortfolioAnalyticsOverview } from './components/analytics/PortfolioAnalyticsOverview';
import { MarketWatchClient } from './components/marketwatch/MarketWatchClient';
import { LandingWalkthrough } from './components/onboarding/LandingWalkthrough';

export function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <PortfolioAnalyticsOverview />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingWalkthrough />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<LoginPage />} /> {/* Reusing login for now */}
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardClient />} />
          <Route path="/marketwatch" element={<MarketWatchClient />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/trade/new" element={<NewTradeClient />} />
          <Route path="/trade/:id" element={<TradeDetailClient />} />
          <Route path="/trade/history" element={<TradeHistoryClient />} />
          <Route path="/settings" element={<MetricsEditorClient />} />
          <Route path="/settings/metrics" element={<MetricsEditorClient />} />
          <Route path="/settings/profile" element={<ProfileSettingsClient />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}



