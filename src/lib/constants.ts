import type { Language, TMEntry, TermbaseEntry, MatchTier } from '@/types';

// Match tiers for analysis
export const MATCH_TIERS: MatchTier[] = [
  { name: '101%', label: 'Context Match', min: 101, max: 101, rate: 0, color: 'bg-purple-500' },
  { name: '100%', label: 'Exact Match', min: 100, max: 100, rate: 10, color: 'bg-green-500' },
  { name: '95-99%', label: 'High Fuzzy', min: 95, max: 99, rate: 25, color: 'bg-teal-500' },
  { name: '85-94%', label: 'Medium Fuzzy', min: 85, max: 94, rate: 50, color: 'bg-yellow-500' },
  { name: '75-84%', label: 'Low Fuzzy', min: 75, max: 84, rate: 75, color: 'bg-orange-500' },
  { name: 'New', label: 'No Match', min: 0, max: 74, rate: 100, color: 'bg-red-500' },
];

export const LANGUAGES: Language[] = [
  { code: 'EN', name: 'English', flag: '🇺🇸' },
  { code: 'KO', name: 'Korean', flag: '🇰🇷' },
  { code: 'JA', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ZH', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'FR', name: 'French', flag: '🇫🇷' },
  { code: 'DE', name: 'German', flag: '🇩🇪' },
];

// Sample Translation Memory data
export const SAMPLE_TM: TMEntry[] = [
  // === 환영/인사 관련 ===
  { source: "Welcome to CloudSync!", target: "CloudSync에 오신 것을 환영합니다!" },
  { source: "Welcome to CloudSync Pro!", target: "CloudSync Pro에 오신 것을 환영합니다!" },
  { source: "Thank you for choosing CloudSync.", target: "CloudSync를 선택해 주셔서 감사합니다." },
  { source: "Thank you for choosing CloudSync Pro.", target: "CloudSync Pro를 선택해 주셔서 감사합니다." },
  { source: "Thank you for using our service.", target: "저희 서비스를 이용해 주셔서 감사합니다." },

  // === 계정 관련 ===
  { source: "Your account has been created successfully.", target: "계정이 성공적으로 생성되었습니다." },
  { source: "Your account has been updated successfully.", target: "프로필이 성공적으로 업데이트되었습니다." },
  { source: "Your password has been changed successfully.", target: "비밀번호가 성공적으로 변경되었습니다." },
  { source: "Your settings have been saved successfully.", target: "설정이 성공적으로 저장되었습니다." },
  { source: "Create your account using your email address.", target: "이메일 주소를 사용하여 계정을 생성하세요." },
  { source: "Log in with your existing credentials.", target: "기존 자격 증명으로 로그인하세요." },

  // === 로그인/인증 관련 ===
  { source: "Please log in to continue.", target: "계속하려면 로그인해 주세요." },
  { source: "Please log in to continue using our service.", target: "서비스를 계속 이용하시려면 로그인해 주세요." },
  { source: "Please sign in to access your account.", target: "계정에 접근하려면 로그인해 주세요." },
  { source: "Enter your email address and password.", target: "이메일 주소와 비밀번호를 입력하세요." },
  { source: "Forgot your password?", target: "비밀번호를 잊으셨나요?" },
  { source: "Remember me", target: "로그인 상태 유지" },
  { source: "You have successfully logged in.", target: "성공적으로 로그인되었습니다." },
  { source: "Login failed. Please check your credentials.", target: "로그인에 실패했습니다. 자격 증명을 확인해 주세요." },
  { source: "Your session has expired.", target: "세션이 만료되었습니다." },
  { source: "Your session has expired. Please log in again.", target: "세션이 만료되었습니다. 다시 로그인해 주세요." },

  // === 파일/다운로드/업로드 관련 ===
  { source: "Click the Download button to save your file.", target: "파일을 저장하려면 다운로드 버튼을 클릭하세요." },
  { source: "Click the Upload button to add your file.", target: "파일을 추가하려면 업로드 버튼을 클릭하세요." },
  { source: "To download your files, click the Download button below.", target: "파일을 다운로드하려면 아래 다운로드 버튼을 클릭하세요." },
  { source: "Upload completed successfully.", target: "업로드가 성공적으로 완료되었습니다." },
  { source: "File size exceeds the limit.", target: "파일 크기가 제한을 초과합니다." },
  { source: "Invalid file format.", target: "잘못된 파일 형식입니다." },
  { source: "Start uploading your files to the cloud.", target: "클라우드에 파일 업로드를 시작하세요." },
  { source: "Your files, anywhere, anytime.", target: "언제 어디서나 파일에 접근하세요." },

  // === 도움말/지원 관련 ===
  { source: "If you need help, please contact our support team.", target: "도움이 필요하시면 고객지원팀에 문의해 주세요." },
  { source: "If you need assistance, please contact support.", target: "도움이 필요하시면 지원팀에 문의해 주세요." },
  { source: "Contact our support team if the problem persists.", target: "문제가 지속되면 고객지원팀에 문의해 주세요." },
  { source: "For support, email us at support@cloudsync.com", target: "지원이 필요하시면 support@cloudsync.com으로 이메일을 보내주세요." },
  { source: "We are here to help you succeed.", target: "저희가 성공을 도와드리겠습니다." },

  // === 설정 관련 ===
  { source: "Update your profile information.", target: "프로필 정보를 업데이트하세요." },
  { source: "Choose which notifications you want to receive.", target: "받고 싶은 알림을 선택하세요." },
  { source: "Enable two-factor authentication for enhanced security.", target: "보안 강화를 위해 2단계 인증을 활성화하세요." },
  { source: "Access your settings by clicking the gear icon.", target: "톱니바퀴 아이콘을 클릭하여 설정에 접근하세요." },

  // === 변경/저장/취소 관련 ===
  { source: "Save Changes", target: "변경사항 저장" },
  { source: "Changes have been saved.", target: "변경사항이 저장되었습니다." },
  { source: "Changes have been saved successfully.", target: "변경사항이 성공적으로 저장되었습니다." },
  { source: "Cancel", target: "취소" },
  { source: "Confirm", target: "확인" },
  { source: "Yes", target: "예" },
  { source: "No", target: "아니오" },

  // === 삭제/확인 관련 ===
  { source: "Are you sure you want to delete this item?", target: "이 항목을 삭제하시겠습니까?" },
  { source: "Are you sure you want to delete this file?", target: "이 파일을 삭제하시겠습니까?" },
  { source: "This action cannot be undone.", target: "이 작업은 취소할 수 없습니다." },

  // === 검색/필터/정렬 관련 ===
  { source: "Search", target: "검색" },
  { source: "Search files...", target: "파일 검색..." },
  { source: "Filter by", target: "필터" },
  { source: "Sort by", target: "정렬" },
  { source: "No results found.", target: "결과를 찾을 수 없습니다." },

  // === 상태/메시지 관련 ===
  { source: "Loading...", target: "로딩 중..." },
  { source: "Please wait...", target: "잠시만 기다려 주세요..." },
  { source: "Please try again later.", target: "나중에 다시 시도해 주세요." },
  { source: "An error occurred.", target: "오류가 발생했습니다." },
  { source: "An error occurred. Please try again later.", target: "오류가 발생했습니다. 나중에 다시 시도해 주세요." },
  { source: "Connection failed.", target: "연결에 실패했습니다." },
  { source: "Connection failed. Please check your internet connection.", target: "연결에 실패했습니다. 인터넷 연결을 확인해 주세요." },
  { source: "Please check your internet connection.", target: "인터넷 연결을 확인해 주세요." },

  // === 기능 관련 ===
  { source: "Real-time sync across all connected devices.", target: "연결된 모든 기기에서 실시간 동기화." },
  { source: "Real-time collaboration with team members.", target: "팀원들과 실시간 협업." },
  { source: "Automatic file synchronization across all your devices.", target: "모든 기기에서 자동 파일 동기화." },
  { source: "Advanced security with end-to-end encryption.", target: "종단 간 암호화로 고급 보안 제공." },
  { source: "End-to-end encryption for all file transfers.", target: "모든 파일 전송에 종단 간 암호화 적용." },
  { source: "Unlimited storage for premium users.", target: "프리미엄 사용자를 위한 무제한 저장 공간." },
  { source: "Two-factor authentication support.", target: "2단계 인증 지원." },
  { source: "Secure file sharing with password protection.", target: "비밀번호 보호로 안전한 파일 공유." },

  // === 시작하기/단계 관련 ===
  { source: "Getting Started", target: "시작하기" },
  { source: "Step 1: Create your account", target: "1단계: 계정 생성" },
  { source: "Step 2: Upload your files", target: "2단계: 파일 업로드" },
  { source: "Step 3: Share with your team", target: "3단계: 팀과 공유" },
  { source: "Go to Settings and click on Check for Updates.", target: "설정으로 이동하여 업데이트 확인을 클릭하세요." },
  { source: "Download and install the latest version.", target: "최신 버전을 다운로드하고 설치하세요." },
  { source: "Restart the application to complete the update.", target: "업데이트를 완료하려면 애플리케이션을 다시 시작하세요." },
  { source: "Verify your email by clicking the link we sent you.", target: "보내드린 링크를 클릭하여 이메일을 인증하세요." },

  // === 팁/문제해결 관련 ===
  { source: "Keep your application updated to the latest version.", target: "애플리케이션을 최신 버전으로 유지하세요." },
  { source: "Use a stable internet connection for faster sync.", target: "빠른 동기화를 위해 안정적인 인터넷 연결을 사용하세요." },
  { source: "Clear your browser cache and cookies.", target: "브라우저 캐시와 쿠키를 삭제하세요." },
  { source: "Update the app to the latest version.", target: "앱을 최신 버전으로 업데이트하세요." },

  // === 날짜/시간 관련 ===
  { source: "Date Modified", target: "수정 날짜" },
  { source: "Date Created", target: "생성 날짜" },
  { source: "Last Updated", target: "마지막 업데이트" },

  // === 기타 UI 요소 ===
  { source: "Dashboard", target: "대시보드" },
  { source: "Recent Files", target: "최근 파일" },
  { source: "File Name", target: "파일명" },
  { source: "File Size", target: "파일 크기" },
  { source: "Log In", target: "로그인" },
  { source: "Sign Up", target: "회원가입" },
  { source: "Log Out", target: "로그아웃" },
  { source: "Upload File", target: "파일 업로드" },
  { source: "Download", target: "다운로드" },
  { source: "Delete", target: "삭제" },
  { source: "Share", target: "공유" },
  { source: "Change Password", target: "비밀번호 변경" },
  { source: "Current Password", target: "현재 비밀번호" },
  { source: "New Password", target: "새 비밀번호" },
  { source: "Confirm New Password", target: "새 비밀번호 확인" },
];

// Sample Termbase data
export const SAMPLE_TERMBASE: TermbaseEntry[] = [
  // === 핵심 용어 (금지어 포함) ===
  { source: "account", target: "계정", note: "어카운트 X" },
  { source: "download", target: "다운로드", note: "" },
  { source: "upload", target: "업로드", note: "올리기 X" },
  { source: "login", target: "로그인", note: "" },
  { source: "log in", target: "로그인", note: "" },
  { source: "sign in", target: "로그인", note: "로그인으로 통일" },
  { source: "logout", target: "로그아웃", note: "" },
  { source: "log out", target: "로그아웃", note: "" },
  { source: "password", target: "비밀번호", note: "패스워드 X" },
  { source: "email", target: "이메일", note: "" },
  { source: "notification", target: "알림", note: "노티피케이션 X" },
  { source: "user", target: "사용자", note: "유저 X" },
  { source: "setting", target: "설정", note: "세팅 X" },
  { source: "settings", target: "설정", note: "세팅 X" },

  // === 파일 관련 ===
  { source: "file", target: "파일", note: "" },
  { source: "folder", target: "폴더", note: "" },
  { source: "document", target: "문서", note: "" },
  { source: "storage", target: "저장 공간", note: "스토리지 허용" },
  { source: "cloud", target: "클라우드", note: "" },
  { source: "sync", target: "동기화", note: "싱크 X" },
  { source: "synchronization", target: "동기화", note: "" },
  { source: "backup", target: "백업", note: "" },

  // === 액션 관련 ===
  { source: "delete", target: "삭제", note: "" },
  { source: "save", target: "저장", note: "" },
  { source: "cancel", target: "취소", note: "" },
  { source: "confirm", target: "확인", note: "" },
  { source: "submit", target: "제출", note: "" },
  { source: "search", target: "검색", note: "" },
  { source: "filter", target: "필터", note: "" },
  { source: "sort", target: "정렬", note: "" },
  { source: "edit", target: "편집", note: "" },
  { source: "update", target: "업데이트", note: "" },
  { source: "share", target: "공유", note: "" },
  { source: "install", target: "설치", note: "" },
  { source: "restart", target: "다시 시작", note: "재시작 허용" },

  // === UI 요소 ===
  { source: "button", target: "버튼", note: "" },
  { source: "menu", target: "메뉴", note: "" },
  { source: "tab", target: "탭", note: "" },
  { source: "popup", target: "팝업", note: "" },
  { source: "dashboard", target: "대시보드", note: "" },
  { source: "profile", target: "프로필", note: "" },
  { source: "preferences", target: "환경설정", note: "" },
  { source: "icon", target: "아이콘", note: "" },

  // === 보안 관련 ===
  { source: "security", target: "보안", note: "" },
  { source: "authentication", target: "인증", note: "" },
  { source: "two-factor authentication", target: "2단계 인증", note: "" },
  { source: "encryption", target: "암호화", note: "" },
  { source: "credentials", target: "자격 증명", note: "" },
  { source: "permission", target: "권한", note: "" },
  { source: "access", target: "접근", note: "액세스 X" },

  // === 상태 관련 ===
  { source: "enabled", target: "활성화됨", note: "" },
  { source: "disabled", target: "비활성화됨", note: "" },
  { source: "pending", target: "대기 중", note: "" },
  { source: "completed", target: "완료됨", note: "" },
  { source: "failed", target: "실패", note: "" },
  { source: "success", target: "성공", note: "" },
  { source: "error", target: "오류", note: "에러 허용" },
  { source: "warning", target: "경고", note: "" },
  { source: "expired", target: "만료됨", note: "" },

  // === 제품 관련 ===
  { source: "CloudSync", target: "CloudSync", note: "번역하지 않음" },
  { source: "version", target: "버전", note: "" },
  { source: "release", target: "릴리즈", note: "출시 허용" },
  { source: "feature", target: "기능", note: "피처 X" },
  { source: "premium", target: "프리미엄", note: "" },

  // === 기타 ===
  { source: "support", target: "지원", note: "서포트 X" },
  { source: "support team", target: "고객지원팀", note: "서포트팀 X" },
  { source: "device", target: "기기", note: "디바이스 허용" },
  { source: "connection", target: "연결", note: "커넥션 X" },
  { source: "internet", target: "인터넷", note: "" },
  { source: "browser", target: "브라우저", note: "" },
  { source: "cache", target: "캐시", note: "" },
  { source: "cookies", target: "쿠키", note: "" },
  { source: "session", target: "세션", note: "" },
  { source: "application", target: "애플리케이션", note: "앱 허용" },
  { source: "app", target: "앱", note: "" },
];
