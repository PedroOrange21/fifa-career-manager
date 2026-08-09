import { useCallback, useMemo, useState } from 'react';
import { RefreshCcw, Shield, ShieldAlert } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { ClubDataProvider } from '../../context/ClubDataContext';
import { UiChromeContext } from '../../context/UiChromeContext';
import Header from './Header';
import BottomNav from './BottomNav';
import ClubModal from '../clubs/ClubModal';
import ConfirmModal from '../common/ConfirmModal';
import ClubTab from '../club/ClubTab';
import MatchTab from '../match/MatchTab';
import MarketShell from '../scouting/MarketShell';
import OfficeTab from '../economy/OfficeTab';
import ProfileTab from '../profile/ProfileTab';

export default function ClubShell() {
  const {
    clubs, loadingClubs, activeClubId, setActiveClubId, showClubModal, setShowClubModal,
    clubToDelete, setClubToDelete, confirmDeleteClub, editingClub, setEditingClub,
  } = useClubs();

  const [activeTab, setActiveTab] = useState('club');
  const [clubSubTab, setClubSubTab] = useState('squad');
  const [marketSubTab, setMarketSubTab] = useState('scouting');
  const [officeSubTab, setOfficeSubTab] = useState('finance');
  const [pendingEditPlayer, setPendingEditPlayer] = useState(null);
  const [pendingPrefill, setPendingPrefill] = useState(null);
  const [chromeHiddenCount, setChromeHiddenCount] = useState(0);

  const hasNoClubs = clubs.length === 0 && !loadingClubs;
  const chromeHidden = chromeHiddenCount > 0;
  const hideChrome = useCallback(() => setChromeHiddenCount((c) => c + 1), []);
  const showChrome = useCallback(() => setChromeHiddenCount((c) => Math.max(0, c - 1)), []);
  const uiChromeValue = useMemo(() => ({ hide: hideChrome, show: showChrome }), [hideChrome, showChrome]);

  const requestEditPlayer = (player) => { setActiveTab('club'); setClubSubTab('squad'); setPendingEditPlayer(player); };
  const requestSignScout = (prefillData, scoutId) => { setActiveTab('club'); setClubSubTab('squad'); setPendingPrefill({ ...prefillData, __scoutId: scoutId }); };
  const requestNewPlayer = () => { setActiveTab('club'); setClubSubTab('squad'); setPendingPrefill({}); };
  const switchClub = (clubId) => { setActiveClubId(clubId); setActiveTab('club'); setClubSubTab('squad'); };
  const goToScoutingMarket = () => { setActiveTab('market'); setMarketSubTab('scouting'); };
  const goToFinance = () => { setActiveTab('office'); setOfficeSubTab('finance'); };

  return (
    <ClubDataProvider>
      <UiChromeContext.Provider value={uiChromeValue}>
      <div className="min-h-screen bg-canvas text-fg flex flex-col overscroll-none" style={{ overscrollBehaviorY: 'none' }}>
        {!chromeHidden && <Header setActiveTab={setActiveTab} onSwitchClub={switchClub} onNavigateToFinance={goToFinance} />}

        <main className="p-2 md:p-4 max-w-lg mx-auto flex flex-col flex-1 w-full relative z-10 pb-28 md:pb-32">
          {loadingClubs ? (
            <div className="flex-1 flex flex-col items-center justify-center mt-12"><RefreshCcw className="animate-spin text-green-500 mb-4" size={30} /><span className="text-fg-muted text-[10px] font-bold uppercase tracking-widest">Cargando...</span></div>
          ) : hasNoClubs ? (
            <div className="flex-1 flex flex-col items-center justify-center mt-12 text-center opacity-50">
              <Shield className="w-16 h-16 text-fg-faint mb-4" />
              <h2 className="text-xl font-black uppercase italic">Sin Clubes Activos</h2>
              <p className="text-xs font-bold text-fg-muted mt-2">Abre el menú arriba a la derecha para crear uno.</p>
            </div>
          ) : (
            <>
              {activeTab === 'club' && activeClubId && (
                <ClubTab
                  subTab={clubSubTab} setSubTab={setClubSubTab}
                  onNavigateToScouting={goToScoutingMarket}
                  pendingEditPlayer={pendingEditPlayer} onConsumePendingEdit={() => setPendingEditPlayer(null)}
                  pendingPrefill={pendingPrefill} onConsumePendingPrefill={() => setPendingPrefill(null)}
                />
              )}
              {activeTab === 'match' && activeClubId && <MatchTab />}
              {activeTab === 'market' && activeClubId && (
                <MarketShell subTab={marketSubTab} setSubTab={setMarketSubTab} onSignScout={requestSignScout} onRequestEditPlayer={requestEditPlayer} />
              )}
              {activeTab === 'office' && activeClubId && (
                <OfficeTab subTab={officeSubTab} setSubTab={setOfficeSubTab} onCreatePlayer={requestNewPlayer} />
              )}
              {activeTab === 'profile' && <ProfileTab />}
            </>
          )}
        </main>

        {!chromeHidden && !hasNoClubs && !loadingClubs && activeClubId && <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />}

        {showClubModal && <ClubModal onFirstClubCreated={() => { setActiveTab('club'); setClubSubTab('squad'); setPendingPrefill({}); }} />}
        {editingClub && <ClubModal editingClub={editingClub} onClose={() => setEditingClub(null)} />}

        {clubToDelete && (
          <ConfirmModal
            icon={ShieldAlert}
            iconClassName="text-orange-500"
            borderClassName="border-orange-500/30"
            title="¿Borrar Modo Carrera?"
            message="Se borrará todo el club y sus jugadores para siempre."
            confirmLabel="Sí, Borrar Club"
            confirmClassName="bg-orange-500 text-black shadow-orange-500/20 hover:bg-orange-400"
            onCancel={() => setClubToDelete(null)}
            onConfirm={confirmDeleteClub}
          />
        )}
      </div>
      </UiChromeContext.Provider>
    </ClubDataProvider>
  );
}
