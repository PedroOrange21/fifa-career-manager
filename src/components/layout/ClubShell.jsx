import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshCcw, Shield, ShieldAlert } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { ClubDataProvider } from '../../context/ClubDataContext';
import { UiChromeContext } from '../../context/UiChromeContext';
import Header from './Header';
import BottomNav from './BottomNav';
import Footer from './Footer';
import ClubModal from '../clubs/ClubModal';
import ConfirmModal from '../common/ConfirmModal';
import OnboardingWizard from '../onboarding/OnboardingWizard';
import UndoToast from '../common/UndoToast';
import ClubTab from '../club/ClubTab';
import MatchTab from '../match/MatchTab';
import MarketShell from '../scouting/MarketShell';
import OfficeTab from '../economy/OfficeTab';
import SeasonsTab from '../seasons/SeasonsTab';
import ProfileTab from '../profile/ProfileTab';

export default function ClubShell() {
  const {
    clubs, loadingClubs, activeClubId, setActiveClubId, showClubModal, setShowClubModal,
    clubToDelete, setClubToDelete, confirmDeleteClub, editingClub, setEditingClub,
  } = useClubs();

  const [activeTab, setActiveTabRaw] = useState('club');
  // Recuerda la última pestaña visitada antes de entrar a Perfil, para que el botón de
  // cerrar ("X") pueda devolver al usuario exactamente a la vista anterior.
  const lastTabRef = useRef('club');
  const setActiveTab = useCallback((tab) => {
    setActiveTabRaw((prev) => { if (prev !== 'profile') lastTabRef.current = prev; return tab; });
  }, []);
  const closeProfile = useCallback(() => setActiveTab(lastTabRef.current || 'club'), [setActiveTab]);
  const [clubSubTab, setClubSubTab] = useState('squad');
  const [marketSubTab, setMarketSubTab] = useState('scouting');
  const [officeSubTab, setOfficeSubTab] = useState('finance');
  const [pendingEditPlayer, setPendingEditPlayer] = useState(null);
  // Campo del Paso 4 (Revisión) a enfocar/desplazar automáticamente al abrir la edición — p.
  // ej. "wage" desde el acceso directo del Desglose de Sueldos en Finanzas. null = comportamiento
  // habitual (se abre en el resumen sin desplazarse a ningún campo en concreto).
  const [pendingEditFocusField, setPendingEditFocusField] = useState(null);
  const [pendingPrefill, setPendingPrefill] = useState(null);
  const [chromeHiddenCount, setChromeHiddenCount] = useState(0);

  const hasNoClubs = clubs.length === 0 && !loadingClubs;
  const chromeHidden = chromeHiddenCount > 0;
  const hideChrome = useCallback(() => setChromeHiddenCount((c) => c + 1), []);
  const showChrome = useCallback(() => setChromeHiddenCount((c) => Math.max(0, c - 1)), []);
  const uiChromeValue = useMemo(() => ({ hide: hideChrome, show: showChrome }), [hideChrome, showChrome]);

  const requestEditPlayer = (player, focusField = null) => { setActiveTab('club'); setClubSubTab('squad'); setPendingEditPlayer(player); setPendingEditFocusField(focusField); };
  const requestSignTarget = (prefillData, targetId) => { setActiveTab('club'); setClubSubTab('squad'); setPendingPrefill({ ...prefillData, __targetId: targetId }); };
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
                  pendingEditPlayer={pendingEditPlayer} pendingEditFocusField={pendingEditFocusField}
                  onConsumePendingEdit={() => { setPendingEditPlayer(null); setPendingEditFocusField(null); }}
                  pendingPrefill={pendingPrefill} onConsumePendingPrefill={() => setPendingPrefill(null)}
                />
              )}
              {activeTab === 'match' && activeClubId && <MatchTab />}
              {activeTab === 'market' && activeClubId && (
                <MarketShell subTab={marketSubTab} setSubTab={setMarketSubTab} onSignTarget={requestSignTarget} onRequestEditPlayer={requestEditPlayer} />
              )}
              {activeTab === 'office' && activeClubId && (
                <OfficeTab subTab={officeSubTab} setSubTab={setOfficeSubTab} onRequestEditPlayer={requestEditPlayer} />
              )}
              {activeTab === 'season' && activeClubId && <SeasonsTab />}
              {activeTab === 'profile' && <ProfileTab onClose={closeProfile} />}
            </>
          )}
          <Footer />
        </main>

        {!chromeHidden && !hasNoClubs && !loadingClubs && activeClubId && <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />}

        {showClubModal && <ClubModal onFirstClubCreated={() => { setActiveTab('club'); setClubSubTab('squad'); }} />}
        {editingClub && <ClubModal editingClub={editingClub} onClose={() => setEditingClub(null)} />}

        {/* Se autogestiona: decide internamente si corresponde mostrarse (club activo sin
            plantilla y sin el onboarding ya resuelto) sin que ClubShell tenga que saberlo.
            Se excluye mientras showClubModal está abierto: ese caso ya lo lleva el propio
            asistente de creación (ClubModal -> OnboardingWizardModal clubExists=false), y
            mostrar los dos a la vez duplicaría el modal para el mismo club recién creado. */}
        {activeClubId && !loadingClubs && !showClubModal && <OnboardingWizard />}

        {/* Toast de "Deshacer" (eliminar jugador, finalizar cesión, vender jugador, eliminar
            objetivo): se autogestiona leyendo pendingUndo del contexto, montado a nivel de
            ClubShell para sobrevivir a la navegación entre pestañas mientras dura la ventana
            de deshacer. */}
        {activeClubId && <UndoToast />}

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
