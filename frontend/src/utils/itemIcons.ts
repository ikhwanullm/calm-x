import {
  Baby, BarChart3, BookOpen, Briefcase, Calendar, Camera, Car, Cloud, Code, Compass, Database, Dumbbell,
  FileText, Flag, GitBranch, Globe, GraduationCap, Handshake, Heart, House, Leaf, Lightbulb, Megaphone,
  Music, Package, PawPrint, Plane, Presentation, Puzzle, Rocket, Server, Shield, Sparkles, Sprout, Star,
  Target, Users, Utensils, Wallet, Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ItemColor } from '@/types/models'

export interface ItemIconOption {
  key: string
  label: string
  Icon: LucideIcon
}

/** The icons a Project or Area can have, grouped loosely. The backend accepts any lowercase key; unknown keys show the fallback letter. */
export const ICON_GROUPS: { name: string; icons: ItemIconOption[] }[] = [
  {
    name: 'Work',
    icons: [
      { key: 'briefcase', label: 'Briefcase', Icon: Briefcase },
      { key: 'database', label: 'Database', Icon: Database },
      { key: 'server', label: 'Server', Icon: Server },
      { key: 'cloud', label: 'Cloud', Icon: Cloud },
      { key: 'code', label: 'Code', Icon: Code },
      { key: 'git-branch', label: 'Git branch', Icon: GitBranch },
      { key: 'chart-bar', label: 'Chart', Icon: BarChart3 },
      { key: 'shield', label: 'Shield', Icon: Shield },
      { key: 'rocket', label: 'Rocket', Icon: Rocket },
      { key: 'file-text', label: 'Document', Icon: FileText },
      { key: 'presentation', label: 'Presentation', Icon: Presentation },
      { key: 'users', label: 'People', Icon: Users },
      { key: 'handshake', label: 'Handshake', Icon: Handshake },
      { key: 'calendar', label: 'Calendar', Icon: Calendar },
      { key: 'wallet', label: 'Wallet', Icon: Wallet },
    ],
  },
  {
    name: 'Life',
    icons: [
      { key: 'home', label: 'Home', Icon: House },
      { key: 'heart', label: 'Heart', Icon: Heart },
      { key: 'dumbbell', label: 'Dumbbell', Icon: Dumbbell },
      { key: 'book-open', label: 'Book', Icon: BookOpen },
      { key: 'graduation-cap', label: 'Graduation cap', Icon: GraduationCap },
      { key: 'plane', label: 'Plane', Icon: Plane },
      { key: 'car', label: 'Car', Icon: Car },
      { key: 'utensils', label: 'Utensils', Icon: Utensils },
      { key: 'music', label: 'Music', Icon: Music },
      { key: 'camera', label: 'Camera', Icon: Camera },
      { key: 'sprout', label: 'Sprout', Icon: Sprout },
      { key: 'baby', label: 'Baby', Icon: Baby },
      { key: 'paw-print', label: 'Paw print', Icon: PawPrint },
    ],
  },
  {
    name: 'General',
    icons: [
      { key: 'star', label: 'Star', Icon: Star },
      { key: 'flag', label: 'Flag', Icon: Flag },
      { key: 'target', label: 'Target', Icon: Target },
      { key: 'lightbulb', label: 'Idea', Icon: Lightbulb },
      { key: 'puzzle', label: 'Puzzle', Icon: Puzzle },
      { key: 'wrench', label: 'Wrench', Icon: Wrench },
      { key: 'package', label: 'Package', Icon: Package },
      { key: 'globe', label: 'Globe', Icon: Globe },
      { key: 'megaphone', label: 'Megaphone', Icon: Megaphone },
      { key: 'compass', label: 'Compass', Icon: Compass },
      { key: 'leaf', label: 'Leaf', Icon: Leaf },
      { key: 'sparkles', label: 'Sparkles', Icon: Sparkles },
    ],
  },
]

export const ITEM_ICONS: ItemIconOption[] = ICON_GROUPS.flatMap((g) => g.icons)

const BY_KEY = new Map(ITEM_ICONS.map((o) => [o.key, o]))

export function findItemIcon(key: string | null | undefined): ItemIconOption | undefined {
  return key ? BY_KEY.get(key) : undefined
}

export const ITEM_COLORS: { key: ItemColor; label: string }[] = [
  { key: 'purple', label: 'Purple' },
  { key: 'blue', label: 'Blue' },
  { key: 'teal', label: 'Teal' },
  { key: 'pink', label: 'Pink' },
  { key: 'slate', label: 'Slate' },
]

export function isItemColor(value: string | null | undefined): value is ItemColor {
  return ITEM_COLORS.some((c) => c.key === value)
}
