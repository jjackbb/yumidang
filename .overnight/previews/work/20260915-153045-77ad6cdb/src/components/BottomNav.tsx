import React from 'react';
import { Home, Compass, MessageSquare, User, Plus } from 'lucide-react';

export type NavTab = 'home' | 'explore' | 'chat' | 'me';

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenCreate: () => void;
  unreadChatCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenCreate,
  unreadChatCount = 1,
}) => {
  return (
    <>
      {/* Floating Action Button (FAB) matching the purple + button in screenshot (Hidden in chat view) */}
      {activeTab !== 'chat' && (
        <button
          id="btn-fab-create"
          onClick={onOpenCreate}
          style={{ right: 'max(24px, calc((100vw - 440px) / 2 + 24px))' }}
          className="fixed bottom-[74px] right-6 z-30 w-[54px] h-[54px] rounded-full bg-[#6c2cf5] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(108,44,245,0.45)] hover:bg-[#5820d8] active:scale-95 transition-transform"
          aria-label="동행 모집하기"
        >
          <Plus className="w-7 h-7 stroke-[2.6]" />
        </button>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md px-3 py-2 flex items-center justify-around max-w-[440px] mx-auto shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        {/* Tab 1: 홈 */}
        <button
          id="nav-tab-home"
          onClick={() => onChangeTab('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors ${
            activeTab === 'home' ? 'text-[#6c2cf5]' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Home
            className={`w-[23px] h-[23px] ${
              activeTab === 'home' ? 'stroke-[2.5] fill-[#6c2cf5]' : 'stroke-[1.9]'
            }`}
          />
          <span
            className={`text-[12px] mt-1 font-medium tracking-tight ${
              activeTab === 'home' ? 'font-bold text-[#6c2cf5]' : 'text-gray-600'
            }`}
          >
            홈
          </span>
        </button>

        {/* Tab 2: U (주변/둘러보기) */}
        <button
          id="nav-tab-explore"
          onClick={() => onChangeTab('explore')}
          className={`flex-1 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors ${
            activeTab === 'explore' ? 'text-[#6c2cf5]' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Compass
            className={`w-[23px] h-[23px] ${
              activeTab === 'explore' ? 'stroke-[2.5] text-[#6c2cf5]' : 'stroke-[1.9]'
            }`}
          />
          <span
            className={`text-[12px] mt-1 font-medium tracking-tight ${
              activeTab === 'explore' ? 'font-bold text-[#6c2cf5]' : 'text-gray-600'
            }`}
          >
            U
          </span>
        </button>

        {/* Tab 3: 채팅 */}
        <button
          id="nav-tab-chat"
          onClick={() => onChangeTab('chat')}
          className={`flex-1 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors relative ${
            activeTab === 'chat' ? 'text-[#6c2cf5]' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <div className="relative">
            <MessageSquare
              className={`w-[23px] h-[23px] ${
                activeTab === 'chat' ? 'stroke-[2.5] text-[#6c2cf5]' : 'stroke-[1.9]'
              }`}
            />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#6c2cf5] rounded-full border border-white" />
            )}
          </div>
          <span
            className={`text-[12px] mt-1 font-medium tracking-tight ${
              activeTab === 'chat' ? 'font-bold text-[#6c2cf5]' : 'text-gray-600'
            }`}
          >
            채팅
          </span>
        </button>

        {/* Tab 4: Me */}
        <button
          id="nav-tab-me"
          onClick={() => onChangeTab('me')}
          className={`flex-1 flex flex-col items-center justify-center py-1 cursor-pointer transition-colors ${
            activeTab === 'me' ? 'text-[#6c2cf5]' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <User
            className={`w-[23px] h-[23px] ${
              activeTab === 'me' ? 'stroke-[2.5] text-[#6c2cf5]' : 'stroke-[1.9]'
            }`}
          />
          <span
            className={`text-[12px] mt-1 font-medium tracking-tight ${
              activeTab === 'me' ? 'font-bold text-[#6c2cf5]' : 'text-gray-600'
            }`}
          >
            Me
          </span>
        </button>
      </nav>
    </>
  );
};
