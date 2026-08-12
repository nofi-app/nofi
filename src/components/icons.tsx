import {
  AlertCircle,
  Archive,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Download,
  Eye,
  EyeOff,
  Folder,
  History,
  Link,
  Lock,
  Share2,
  Moon,
  NotepadText,
  Pin,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

export type IconProps = LucideProps

export const NotesIcon = (p: IconProps) => <NotepadText {...p} />
export const TrashIcon = (p: IconProps) => <Trash2 {...p} />
export const TagIcon = (p: IconProps) => <Tag {...p} />
export const FolderIcon = (p: IconProps) => <Folder {...p} />
export const PlusIcon = (p: IconProps) => <Plus {...p} />
export const SearchIcon = (p: IconProps) => <Search {...p} />
export const PinIcon = (p: IconProps) => <Pin {...p} />
export const ArchiveIcon = (p: IconProps) => <Archive {...p} />
export const LockIcon = (p: IconProps) => <Lock {...p} />
export const HistoryIcon = (p: IconProps) => <History {...p} />
export const DownloadIcon = (p: IconProps) => <Download {...p} />
export const UploadIcon = (p: IconProps) => <Upload {...p} />
export const EyeIcon = (p: IconProps) => <Eye {...p} />
export const EyeOffIcon = (p: IconProps) => <EyeOff {...p} />
export const XIcon = (p: IconProps) => <X {...p} />
export const SunIcon = (p: IconProps) => <Sun {...p} />
export const MoonIcon = (p: IconProps) => <Moon {...p} />
export const SparkIcon = (p: IconProps) => <Sparkles {...p} />
export const CheckIcon = (p: IconProps) => <Check {...p} />
export const AlertIcon = (p: IconProps) => <AlertCircle {...p} />
export const RestoreIcon = (p: IconProps) => <RotateCcw {...p} />
export const PrintIcon = (p: IconProps) => <Printer {...p} />
export const ChevronIcon = (p: IconProps) => <ChevronDown {...p} />
export const BackIcon = (p: IconProps) => <ChevronLeft {...p} />
export const LinkIcon = (p: IconProps) => <Link {...p} />
export const SettingsIcon = (p: IconProps) => <Settings {...p} />
export const ShareIcon = (p: IconProps) => <Share2 {...p} />
export const CopyIcon = (p: IconProps) => <Copy {...p} />

