import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Header } from './components/Header';
import { Overview } from './components/Overview';
import { RequestsTable } from './components/RequestsTable';
import { NetworkMap } from './components/NetworkMap';
import { BlockPlanGantt } from './components/BlockPlanGantt';
import { LiveMonitoring } from './components/LiveMonitoring';
import { EmergencyControl } from './components/EmergencyControl';
import { TrainsTable } from './components/TrainsTable';
import { MaintenanceRequest, NetworkData, BlockPlanItem, TrainItem } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [blocks, setBlocks] = useState<BlockPlanItem[]>([]);
  const [trains, setTrains] = useState<TrainItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Initial Data Fetch
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [reqsResp, netResp, planResp, trainsResp] = await Promise.all([
        axios.get('/api/requests'),
        axios.get('/api/network'),
        axios.get('/api/plan'),
        axios.get('/api/trains'),
      ]);
      setRequests(reqsResp.data || []);
      setNetwork(netResp.data || null);
      setBlocks(planResp.data || []);
      setTrains(trainsResp.data || []);

      if ((planResp.data || []).length === 0) {
        handleRunOptimization();
      }
    } catch (err) {
      console.error('Error loading initial backend data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Action Handlers
  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      await axios.post('/api/data/seed', { seed: 42 });
      await fetchAllData();
      await handleRunOptimization();
    } catch (err) {
      console.error('Error seeding data:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleRunOptimization = async () => {
    setIsOptimizing(true);
    try {
      const resp = await axios.post('/api/optimize');
      if (resp.data && resp.data.blocks) {
        setBlocks(resp.data.blocks);
      } else {
        const planResp = await axios.get('/api/plan');
        setBlocks(planResp.data || []);
      }
    } catch (err) {
      console.error('Error running optimization:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApproveBlock = async (blockId: string) => {
    try {
      await axios.post(`/api/plan/${blockId}/approve`);
      const planResp = await axios.get('/api/plan');
      setBlocks(planResp.data || []);
    } catch (err) {
      console.error('Error approving block:', err);
    }
  };

  const handleRejectBlock = async (blockId: string, reason: string) => {
    try {
      await axios.post(`/api/plan/${blockId}/reject`, { reason });
      const planResp = await axios.get('/api/plan');
      setBlocks(planResp.data || []);
    } catch (err) {
      console.error('Error rejecting block:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1329] text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSeedData={handleSeedData}
        onRunOptimization={handleRunOptimization}
        isOptimizing={isOptimizing}
        isSeeding={isSeeding}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Loading Indian Railways Planning Engine...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <Overview
                requests={requests}
                blocks={blocks}
                network={network}
                onNavigateToTab={setActiveTab}
                onRunOptimization={handleRunOptimization}
              />
            )}

            {activeTab === 'requests' && <RequestsTable requests={requests} />}

            {activeTab === 'network' && <NetworkMap network={network} blocks={blocks} />}

            {activeTab === 'trains' && <TrainsTable trains={trains} network={network} />}

            {activeTab === 'plan' && (
              <BlockPlanGantt
                blocks={blocks}
                onApprove={handleApproveBlock}
                onReject={handleRejectBlock}
                onRunOptimization={handleRunOptimization}
                isOptimizing={isOptimizing}
              />
            )}

            {activeTab === 'monitoring' && <LiveMonitoring />}

            {activeTab === 'emergency' && (
              <EmergencyControl network={network} onEmergencyHandled={fetchAllData} />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        Indian Railways AI-Powered Automatic Block Planning Decision-Support System (SIH26027 Prototype) • Team Optimists
      </footer>
    </div>
  );
};

export default App;
