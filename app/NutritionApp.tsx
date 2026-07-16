"use client";

import {
  Activity,
  Apple,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Copy,
  Clock3,
  Download,
  Heart,
  Home,
  Info,
  Leaf,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Upload,
  UsersRound,
  Utensils,
  Weight,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { memberProfileSchema, memberSchema, recipeSchema } from "./lib/app-schemas";
import { addDays, dateFromKey, formatMenuDate, formatPageDate, formatWeekRange, getWeekDateKeys } from "./lib/date";
import {
  driTargets,
  initialMeals,
  initialMembers,
  initialRecipes,
  initialShopping,
  initialVitals,
} from "./lib/demo-data";
import { createLocalBackup, LOCAL_DATA_KEY, parseLocalBackup, parseLocalData } from "./lib/local-data";
import type { LocalDataBundle } from "./lib/local-data";
import {
  allocateRecipe,
  calculateRecipe,
  getNutritionStatus,
  sumVectors,
} from "./lib/nutrition";
import { convertShoppingAmount, generateShoppingFromMeals } from "./lib/shopping";
import { nutrientKeys } from "./lib/types";
import type {
  Meal,
  MealSlot,
  Member,
  NutrientKey,
  NutrientVector,
  Recipe,
  ShoppingItem,
  VitalRecord,
} from "./lib/types";

type TabId = "home" | "menu" | "recipes" | "shopping" | "family";
type ModalId = "data" | "recipe" | "recipeEdit" | "meal" | "mealEdit" | "member" | "memberEdit" | "householdEdit" | "vital" | "install" | null;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const navItems = [
  { id: "home" as const, label: "首页", Icon: Home },
  { id: "menu" as const, label: "菜单", Icon: CalendarDays },
  { id: "recipes" as const, label: "菜谱", Icon: Utensils },
  { id: "shopping" as const, label: "购物", Icon: ShoppingBasket },
  { id: "family" as const, label: "家庭", Icon: UsersRound },
];

const todayDateKey = initialMeals[0]?.date ?? "2026-07-16";
const initialLocalData: LocalDataBundle = {
  householdName: "我的家庭",
  members: initialMembers,
  recipes: initialRecipes,
  meals: initialMeals,
  shopping: initialShopping,
  vitals: initialVitals,
};

const slotMeta = {
  breakfast: { label: "早餐", icon: "晨", color: "amber" },
  lunch: { label: "午餐", icon: "午", color: "green" },
  dinner: { label: "晚餐", icon: "暮", color: "coral" },
  snack: { label: "加餐", icon: "点", color: "blue" },
};

const defaultMealTimes: Record<MealSlot, string> = {
  breakfast: "07:30",
  lunch: "12:10",
  dinner: "18:40",
  snack: "15:30",
};

const nutrientMeta: Record<NutrientKey, { label: string; short: string }> = {
  energyKcal: { label: "能量", short: "kcal" },
  proteinG: { label: "蛋白质", short: "g" },
  fatG: { label: "脂肪", short: "g" },
  carbohydrateG: { label: "碳水", short: "g" },
  fiberG: { label: "膳食纤维", short: "g" },
  sodiumMg: { label: "钠", short: "mg" },
  calciumMg: { label: "钙", short: "mg" },
  ironMg: { label: "铁", short: "mg" },
  potassiumMg: { label: "钾", short: "mg" },
  vitaminCMg: { label: "维生素 C", short: "mg" },
  vitaminDUg: { label: "维生素 D", short: "μg" },
};

const customNutrition = (energy: number | null, protein: number | null = null, fat: number | null = null, carbohydrate: number | null = null): NutrientVector => ({
  energyKcal: energy,
  proteinG: protein,
  fatG: fat,
  carbohydrateG: carbohydrate,
  fiberG: null,
  sodiumMg: null,
  calciumMg: null,
  ironMg: null,
  potassiumMg: null,
  vitaminCMg: null,
  vitaminDUg: null,
});

function round(value: number, digits = 0) {
  return Number(value.toFixed(digits));
}

function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getOnlineSnapshot = () => navigator.onLine;
const getServerOnlineSnapshot = () => true;

function AppModal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-panel ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">禾味日历</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function NutrientProgress({ item, compact = false }: { item: ReturnType<typeof getNutritionStatus>; compact?: boolean }) {
  const meta = nutrientMeta[item.key];
  const valueText = item.value === null ? "数据不足" : `${round(item.value, item.key === "energyKcal" ? 0 : 1)} ${meta.short}`;
  return (
    <div className={`nutrient-row ${compact ? "compact" : ""}`}>
      <div className="nutrient-label">
        <span>{meta.label}</span>
        <strong>{valueText}</strong>
      </div>
      <div className="progress-track" aria-label={`${meta.label}进度 ${Math.round(item.percent)}%`}>
        <span className={item.label === "超过参考上限" ? "over" : ""} style={{ width: `${Math.min(item.percent, 100)}%` }} />
      </div>
      {!compact && <small className={item.label === "数据不完整" ? "warning-text" : ""}>{item.label} · 参考 {item.target}{meta.short}</small>}
    </div>
  );
}

function Avatar({ member, active = false, onClick }: { member: Member; active?: boolean; onClick?: () => void }) {
  return (
    <button className={`member-chip ${active ? "active" : ""}`} onClick={onClick} aria-pressed={active}>
      <span className="avatar">{member.avatar}</span>
      <span>{member.name}</span>
    </button>
  );
}

function OverflowMenu({ label, actions }: {
  label: string;
  actions: Array<{ label: string; icon: React.ReactNode; onSelect: () => void; danger?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="overflow-menu" ref={rootRef}>
      <button
        className="icon-button overflow-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="overflow-popover" role="menu" aria-label={label}>
          {actions.map((action) => (
            <button
              key={action.label}
              role="menuitem"
              className={action.danger ? "danger" : ""}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.icon}<span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NutritionApp() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [localData, setLocalData] = useState<LocalDataBundle>(initialLocalData);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(initialMembers[0].id);
  const [modal, setModal] = useState<ModalId>(null);
  const [toast, setToast] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [placingRecipeId, setPlacingRecipeId] = useState<string | null>(null);
  const [placingMealSlot, setPlacingMealSlot] = useState<MealSlot | null>(null);
  const [mealView, setMealView] = useState<"today" | "week">("today");
  const [selectedMealDate, setSelectedMealDate] = useState(todayDateKey);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const isOnline = useSyncExternalStore(subscribeToConnectivity, getOnlineSnapshot, getServerOnlineSnapshot);
  const { householdName, members, recipes, meals, shopping, vitals } = localData;
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? members[0];
  const effectiveSelectedMemberId = selectedMember.id;

  function updateLocalSlice<K extends keyof LocalDataBundle>(key: K, update: React.SetStateAction<LocalDataBundle[K]>) {
    setLocalData((current) => ({
      ...current,
      [key]: typeof update === "function"
        ? (update as (previous: LocalDataBundle[K]) => LocalDataBundle[K])(current[key])
        : update,
    }));
  }

  const setMembers: React.Dispatch<React.SetStateAction<Member[]>> = (update) => updateLocalSlice("members", update);
  const setHouseholdName = (name: string) => updateLocalSlice("householdName", name);
  const setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>> = (update) => updateLocalSlice("recipes", update);
  const setMeals: React.Dispatch<React.SetStateAction<Meal[]>> = (update) => updateLocalSlice("meals", update);
  const setShopping: React.Dispatch<React.SetStateAction<ShoppingItem[]>> = (update) => updateLocalSlice("shopping", update);
  const setVitals: React.Dispatch<React.SetStateAction<VitalRecord[]>> = (update) => updateLocalSlice("vitals", update);

  useEffect(() => {
    let cancelled = false;
    window.queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = window.localStorage.getItem(LOCAL_DATA_KEY);
        if (saved) setLocalData(parseLocalData(saved));
      } catch {
        setStorageError(true);
      } finally {
        setStorageReady(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(localData));
    } catch {
      window.queueMicrotask(() => setStorageError(true));
    }
  }, [localData, storageReady]);

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const actualNutrition = useMemo(() => {
    const vectors = meals
      .filter((meal) => meal.date === todayDateKey && meal.status === "confirmed" && meal.participantIds.includes(effectiveSelectedMemberId))
      .flatMap((meal) => meal.dishes)
      .map((dish) => allocateRecipe(dish.recipeSnapshot, dish.allocationMode, dish.allocations[effectiveSelectedMemberId] ?? 0));
    return vectors.length ? sumVectors(vectors) : Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as NutrientVector;
  }, [meals, effectiveSelectedMemberId]);

  const plannedNutrition = useMemo(() => {
    const vectors = meals
      .filter((meal) => meal.date === todayDateKey && meal.participantIds.includes(effectiveSelectedMemberId))
      .flatMap((meal) => meal.dishes)
      .map((dish) => allocateRecipe(dish.recipeSnapshot, dish.allocationMode, dish.allocations[effectiveSelectedMemberId] ?? 0));
    return vectors.length ? sumVectors(vectors) : Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as NutrientVector;
  }, [meals, effectiveSelectedMemberId]);

  const statuses = useMemo(
    () => nutrientKeys.map((key) => getNutritionStatus(actualNutrition[key], { key, target: driTargets[key], upper: key === "sodiumMg" ? 2000 : undefined })),
    [actualNutrition],
  );

  const notify = (message: string) => setToast(message);

  const confirmMeal = (mealId: string) => {
    setMeals((current) => current.map((meal) => meal.id === mealId ? { ...meal, status: "confirmed" } : meal));
    notify("已计入该日实际摄入");
  };

  const copyMeal = (meal: Meal) => {
    const newMeal: Meal = { ...meal, id: `${meal.id}-${Date.now()}`, date: addDays(meal.date, 1), status: "planned" };
    setMeals((current) => [...current, newMeal]);
    notify("已复制到明天");
  };

  const resetMeal = (mealId: string) => {
    setMeals((current) => current.map((meal) => meal.id === mealId ? { ...meal, status: "planned" } : meal));
    notify("已改回待确认，不再计入实际摄入");
  };

  const deleteMeal = (mealId: string) => {
    setMeals((current) => current.filter((meal) => meal.id !== mealId));
    notify("餐次已删除");
  };

  const duplicateRecipe = (recipe: Recipe) => {
    const copy: Recipe = { ...structuredClone(recipe), id: `${recipe.id}-copy-${Date.now()}`, name: `${recipe.name}（副本）`, favorite: false, updatedAt: "刚刚" };
    setRecipes((current) => [copy, ...current]);
    notify("菜谱副本已创建");
  };

  const deleteRecipe = (recipeId: string) => {
    setRecipes((current) => current.filter((recipe) => recipe.id !== recipeId));
    notify("菜谱已删除，历史餐食快照不受影响");
  };

  const addRecipeToMenu = (recipe: Recipe, slot: MealSlot, time: string, participantIds: string[]) => {
    const newMeal: Meal = {
      id: `meal-${Date.now()}`,
      date: selectedMealDate,
      slot,
      status: "planned",
      time,
      participantIds,
      dishes: [{
        id: `dish-${Date.now()}`,
        recipeId: recipe.id,
        recipeSnapshot: structuredClone(recipe),
        allocationMode: "servings",
        allocations: Object.fromEntries(participantIds.map((memberId) => [memberId, 1])),
      }],
    };
    setMeals((current) => [...current, newMeal]);
    setActiveTab("menu");
    setModal(null);
    setPlacingRecipeId(null);
    setPlacingMealSlot(null);
    notify(`${recipe.name} 已加入${formatMenuDate(selectedMealDate)}的${slotMeta[slot].label}`);
  };

  const saveMealDetails = (updated: Meal) => {
    const previous = meals.find((meal) => meal.id === updated.id);
    const changed = previous ? previous.slot !== updated.slot || previous.time !== updated.time || [...previous.participantIds].sort().join("|") !== [...updated.participantIds].sort().join("|") : true;
    const needsReconfirm = previous?.status === "confirmed" && changed;
    const next = { ...updated, status: needsReconfirm ? "planned" as const : updated.status };
    setMeals((current) => current.map((meal) => meal.id === next.id ? next : meal));
    setModal(null);
    setEditingMeal(null);
    notify(needsReconfirm ? "餐次已修改，请重新确认实吃" : "餐次安排已保存");
  };

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
      notify("安装请求已发送");
      setModal(null);
      return;
    }
    setModal("install");
  };

  const renderView = () => {
    if (activeTab === "menu") return <MenuView meals={meals} members={members} mode={mealView} setMode={setMealView} selectedDate={selectedMealDate} todayDate={todayDateKey} onSelectDate={setSelectedMealDate} onConfirm={confirmMeal} onCopy={copyMeal} onReset={resetMeal} onDelete={deleteMeal} onEdit={(meal) => { setEditingMeal(meal); setModal("mealEdit"); }} onAdd={(slot) => { setPlacingRecipeId(null); setPlacingMealSlot(slot ?? null); setModal("meal"); }} />;
    if (activeTab === "recipes") return <RecipesView recipes={recipes} search={recipeSearch} setSearch={setRecipeSearch} onFavorite={(id) => setRecipes((current) => current.map((recipe) => recipe.id === id ? { ...recipe, favorite: !recipe.favorite } : recipe))} onEdit={(recipe) => { setEditingRecipe(recipe); setModal("recipeEdit"); }} onDuplicate={duplicateRecipe} onDelete={deleteRecipe} onAdd={() => setModal("recipe")} onUse={(recipe) => { setPlacingRecipeId(recipe.id); setPlacingMealSlot(null); setActiveTab("menu"); setModal("meal"); }} />;
    if (activeTab === "shopping") return <ShoppingView shopping={shopping} meals={meals} initialDate={selectedMealDate} setShopping={setShopping} notify={notify} />;
    if (activeTab === "family") return <FamilyView householdName={householdName} members={members} selectedMember={selectedMember} setSelectedMemberId={setSelectedMemberId} vitals={vitals} setMembers={setMembers} onEditHousehold={() => setModal("householdEdit")} onAddMember={() => setModal("member")} onEditMember={(member) => { setEditingMember(member); setModal("memberEdit"); }} onAddVital={() => setModal("vital")} onManageData={() => setModal("data")} />;
    return <HomeView selectedMember={selectedMember} members={members} setSelectedMemberId={setSelectedMemberId} actualNutrition={actualNutrition} plannedNutrition={plannedNutrition} statuses={statuses} meals={meals.filter((meal) => meal.date === todayDateKey)} onConfirm={confirmMeal} onCreateRecipe={() => setModal("recipe")} onNavigate={setActiveTab} />;
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveTab("home")} aria-label="禾味日历首页">
          <span className="brand-mark"><Leaf size={22} /></span>
          <span><strong>禾味日历</strong><small>家庭营养管家</small></span>
        </button>
        <nav aria-label="主导航">
          {navItems.map(({ id, label, Icon }) => (
            <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
              <Icon size={20} /><span>{label}</span>{id === "shopping" && <em>{shopping.filter((item) => !item.checked).length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-card">
          <Utensils size={18} />
          <strong>创建自己的菜谱</strong>
          <p>手工填写菜名、食材重量和营养数据，随时可以继续编辑。</p>
          <button onClick={() => setModal("recipe")}>新建菜谱</button>
        </div>
        <div className="sidebar-foot">
          <button onClick={handleInstall}><Download size={18} />安装到桌面</button>
          <button onClick={() => setModal("data")}><Settings size={18} />本机数据</button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">{formatPageDate(todayDateKey)}</span>
            <h1>{navItems.find((item) => item.id === activeTab)?.label ?? "首页"}</h1>
          </div>
          <div className="top-actions">
            {!isOnline && <span className="offline-pill"><CircleAlert size={15} />离线</span>}
            <span className={`mode-pill ${storageError ? "" : "live"}`}><span />{storageError ? "本机保存失败" : "本机保存"}</span>
            <button className="profile-button" onClick={() => setActiveTab("family")}><span className="avatar">{selectedMember.avatar}</span><span><strong>{selectedMember.name}</strong><small>查看档案</small></span><ChevronRight size={17} /></button>
          </div>
        </header>
        <div className="content">{renderView()}</div>
      </main>

      <nav className="mobile-nav" aria-label="手机主导航">
        {navItems.map(({ id, label, Icon }) => (
          <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
            <Icon size={21} /><span>{label}</span>{id === "shopping" && shopping.some((item) => !item.checked) && <i />}
          </button>
        ))}
      </nav>

      <button className="mobile-fab" onClick={() => setModal("recipe")} aria-label="新建菜谱"><Plus size={23} /></button>
      {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}

      {modal === "data" && <LocalDataModal data={localData} close={() => setModal(null)} notify={notify} onImport={setLocalData} onReset={() => setLocalData(structuredClone(initialLocalData))} />}
      {modal === "recipe" && <RecipeModal close={() => setModal(null)} addRecipe={(recipe) => { setRecipes((current) => [recipe, ...current]); setModal(null); notify("菜谱已保存"); }} />}
      {modal === "recipeEdit" && editingRecipe && <RecipeEditModal recipe={editingRecipe} close={() => { setModal(null); setEditingRecipe(null); }} saveRecipe={(updated) => { setRecipes((current) => current.map((recipe) => recipe.id === updated.id ? updated : recipe)); setModal(null); setEditingRecipe(null); notify("菜谱修改已保存；历史餐食不受影响"); }} />}
      {modal === "meal" && <MealPlacementModal recipes={recipes} members={members} selectedDate={selectedMealDate} initialRecipeId={placingRecipeId} initialSlot={placingMealSlot} close={() => { setModal(null); setPlacingRecipeId(null); setPlacingMealSlot(null); }} addMeal={addRecipeToMenu} />}
      {modal === "mealEdit" && editingMeal && <MealEditModal meal={editingMeal} members={members} close={() => { setModal(null); setEditingMeal(null); }} saveMeal={saveMealDetails} />}
      {modal === "member" && <MemberModal close={() => setModal(null)} addMember={(member) => { setMembers((current) => [...current, member]); setModal(null); notify("家庭成员已添加"); }} />}
      {modal === "memberEdit" && editingMember && <MemberEditModal member={editingMember} close={() => { setModal(null); setEditingMember(null); }} saveMember={(updated) => { setMembers((current) => current.map((member) => member.id === updated.id ? updated : member)); setModal(null); setEditingMember(null); notify("成员档案已保存"); }} />}
      {modal === "householdEdit" && <HouseholdNameModal householdName={householdName} close={() => setModal(null)} saveName={(name) => { setHouseholdName(name); setModal(null); notify("家庭名称已保存"); }} />}
      {modal === "vital" && <VitalModal member={selectedMember} close={() => setModal(null)} addVital={(record) => { setVitals((current) => [...current, record]); setModal(null); notify("体征记录已保存"); }} />}
      {modal === "install" && <AppModal title="添加到手机主屏幕" onClose={() => setModal(null)}><div className="install-steps"><div><span>1</span><p><strong>iPhone Safari</strong>点击分享按钮，再选择“添加到主屏幕”。</p></div><div><span>2</span><p><strong>Android Chrome</strong>打开浏览器菜单，选择“安装应用”。</p></div><div><span>3</span><p><strong>电脑浏览器</strong>点击地址栏右侧的安装图标。</p></div></div><button className="primary-button full" onClick={() => setModal(null)}>知道了</button></AppModal>}
    </div>
  );
}

function HomeView({ selectedMember, members, setSelectedMemberId, actualNutrition, plannedNutrition, statuses, meals, onConfirm, onCreateRecipe, onNavigate }: {
  selectedMember: Member; members: Member[]; setSelectedMemberId: (id: string) => void; actualNutrition: NutrientVector; plannedNutrition: NutrientVector; statuses: ReturnType<typeof getNutritionStatus>[]; meals: Meal[]; onConfirm: (id: string) => void; onCreateRecipe: () => void; onNavigate: (tab: TabId) => void;
}) {
  const energyPercent = Math.min(100, Math.round(((actualNutrition.energyKcal ?? 0) / driTargets.energyKcal) * 100));
  const plannedEnergy = plannedNutrition.energyKcal ?? 0;
  return (
    <div className="dashboard-grid">
      <section className="span-full member-switcher" aria-label="选择家庭成员">
        <span>查看谁的今日营养</span>
        <div>{members.map((member) => <Avatar key={member.id} member={member} active={member.id === selectedMember.id} onClick={() => setSelectedMemberId(member.id)} />)}</div>
      </section>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-kicker"><Leaf size={16} />{selectedMember.name}的今日营养</span>
          <h2>一日三餐，<br />正在稳稳照顾你。</h2>
          <p>已确认早餐；午餐和晚餐共预计 {Math.round(plannedEnergy)} kcal。</p>
          <div className="hero-actions"><button onClick={() => onNavigate("menu")}>查看今日菜单 <ChevronRight size={17} /></button><button className="ghost" onClick={onCreateRecipe}><Plus size={17} />新建菜谱</button></div>
        </div>
        <div className="energy-orbit" style={{ "--progress": `${energyPercent * 3.6}deg` } as React.CSSProperties}>
          <div><small>已摄入</small><strong>{Math.round(actualNutrition.energyKcal ?? 0)}</strong><span>/ {driTargets.energyKcal} kcal</span></div>
        </div>
        <span className="leaf-decoration one">✦</span><span className="leaf-decoration two">·</span>
      </section>

      <section className="card nutrition-card">
        <div className="card-heading"><div><span className="eyebrow">今日参考进度</span><h3>核心营养素</h3></div><button className="text-button" onClick={() => onNavigate("family")}>查看依据 <Info size={15} /></button></div>
        <div className="macro-grid">{statuses.slice(1, 4).map((item) => <NutrientProgress key={item.key} item={item} compact />)}</div>
        <div className="micro-list">{statuses.slice(4, 8).map((item) => <NutrientProgress key={item.key} item={item} />)}</div>
        <div className="reference-note"><Info size={16} /><p>单日结果仅作膳食参考；连续记录比某一天的高低更有意义。</p></div>
      </section>

      <section className="card meal-card">
        <div className="card-heading"><div><span className="eyebrow">今天 · 3 人参与</span><h3>今日餐单</h3></div><button className="round-button" onClick={() => onNavigate("menu")}><ChevronRight size={18} /></button></div>
        <div className="meal-list">{meals.map((meal) => {
          const meta = slotMeta[meal.slot];
          const recipe = meal.dishes[0]?.recipeSnapshot;
          const total = recipe ? calculateRecipe(recipe) : null;
          return <article className="meal-item" key={meal.id}><span className={`meal-icon ${meta.color}`}>{meta.icon}</span><div><span>{meta.label} · {meal.time}</span><strong>{recipe?.name ?? "尚未安排"}</strong><small>{total ? `${Math.round((total.energyKcal ?? 0) / recipe.yieldServings)} kcal / 份` : "点击添加菜品"}</small></div>{meal.status === "confirmed" ? <span className="status confirmed"><Check size={14} />已确认</span> : <button className="status planned" onClick={() => onConfirm(meal.id)}>确认实吃</button>}</article>;
        })}</div>
      </section>

      <button className="scan-card" onClick={onCreateRecipe}>
        <span className="scan-icon"><Plus size={27} /></span><span><small>添加一道自己的菜</small><strong>手工新建菜谱</strong><em>填写食材重量、备注、标签和三大营养素</em></span><ChevronRight size={20} />
      </button>

      <section className="card insight-card"><div className="insight-icon"><Sparkles size={20} /></div><div><span className="eyebrow">今日小提示</span><h3>晚餐加一份深色蔬菜</h3><p>按计划完成晚餐后，钙和膳食纤维仍略低。可以加 100g 菠菜或小油菜。</p></div><button onClick={() => onNavigate("recipes")}>找菜谱</button></section>
    </div>
  );
}

function MenuView({ meals, members, mode, setMode, selectedDate, todayDate, onSelectDate, onConfirm, onCopy, onReset, onDelete, onEdit, onAdd }: { meals: Meal[]; members: Member[]; mode: "today" | "week"; setMode: (mode: "today" | "week") => void; selectedDate: string; todayDate: string; onSelectDate: (date: string) => void; onConfirm: (id: string) => void; onCopy: (meal: Meal) => void; onReset: (id: string) => void; onDelete: (id: string) => void; onEdit: (meal: Meal) => void; onAdd: (slot?: MealSlot) => void }) {
  const weekDateKeys = useMemo(() => getWeekDateKeys(selectedDate), [selectedDate]);
  const visibleMeals = meals
    .filter((meal) => mode === "today" ? meal.date === selectedDate : weekDateKeys.includes(meal.date))
    .sort((first, second) => first.date.localeCompare(second.date) || first.time.localeCompare(second.time));
  const dateLabel = mode === "today" ? formatMenuDate(selectedDate) : formatWeekRange(selectedDate);

  return (
    <div className="page-stack">
      <div className="page-toolbar"><div className="segmented"><button className={mode === "today" ? "active" : ""} onClick={() => setMode("today")}>单日餐单</button><button className={mode === "week" ? "active" : ""} onClick={() => setMode("week")}>本周计划</button></div><button className="primary-button" onClick={() => onAdd()} aria-label="添加已有菜品"><Plus size={18} />添加已有菜品</button></div>
      <section className="menu-date-summary" aria-live="polite">
        <button className="icon-button" onClick={() => onSelectDate(addDays(selectedDate, -7))} aria-label="上一周"><ChevronLeft size={19} /></button>
        <div><span>{mode === "today" ? "正在查看" : "正在查看本周"}</span><strong>{dateLabel}</strong>{selectedDate !== todayDate && <button onClick={() => onSelectDate(todayDate)}>回到今天</button>}</div>
        <button className="icon-button" onClick={() => onSelectDate(addDays(selectedDate, 7))} aria-label="下一周"><ChevronRight size={19} /></button>
      </section>
      <section className="week-strip" aria-label="选择菜单日期">{weekDateKeys.map((dateKey) => {
        const date = dateFromKey(dateKey);
        const selected = dateKey === selectedDate;
        const isToday = dateKey === todayDate;
        const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
        return <button key={dateKey} className={selected ? "active" : ""} aria-label={`${formatMenuDate(dateKey)}${isToday ? "，今天" : ""}`} aria-pressed={selected} onClick={() => { onSelectDate(dateKey); setMode("today"); }}><span>{weekday}</span><strong>{date.getDate()}</strong>{isToday && <i title="今天" />}</button>;
      })}</section>
      {visibleMeals.length === 0 && <section className="menu-empty"><CalendarDays size={27} /><h3>{mode === "today" ? "这一天还没有安排餐食" : "这一周还没有安排餐食"}</h3><p>选择“添加已有菜品”，从菜谱中安排这一餐。</p></section>}
      <div className={mode === "week" ? "week-plan" : "meal-plan"}>{visibleMeals.map((meal) => {
        const meta = slotMeta[meal.slot];
        const recipe = meal.dishes[0]?.recipeSnapshot;
        return <article className="plan-card" key={meal.id}><div className="plan-time"><span className={`meal-icon ${meta.color}`}>{meta.icon}</span><div>{mode === "week" && <span className="plan-date">{formatMenuDate(meal.date)}</span>}<strong>{meta.label}</strong><small><Clock3 size={14} />{meal.time}</small></div></div><div className="plan-food"><div className="food-thumb"><Apple size={26} /></div><div><span className="eyebrow">{recipe?.tags.join(" · ")}</span><h3>{recipe?.name}</h3><p>{recipe?.ingredients.map((ingredient) => ingredient.food.name).join("、")}</p><div className="participant-stack">{meal.participantIds.map((id) => { const member = members.find((item) => item.id === id); return member ? <span key={id} title={member.name}>{member.avatar}</span> : null; })}<small>{meal.participantIds.length} 人参与</small></div></div></div><div className="plan-nutrition"><span>预计每份</span><strong>{Math.round(((recipe && calculateRecipe(recipe).energyKcal) || 0) / (recipe?.yieldServings || 1))}<small> kcal</small></strong><span>蛋白质 {round(((recipe && calculateRecipe(recipe).proteinG) || 0) / (recipe?.yieldServings || 1), 1)}g</span></div><div className="plan-actions">{meal.status === "planned" ? <button className="primary-button" onClick={() => onConfirm(meal.id)}>确认实吃</button> : <span className="status confirmed"><Check size={14} />已确认</span>}<button className="icon-button meal-edit-button" onClick={() => onEdit(meal)} title="编辑餐别、时间和参与成员" aria-label={`编辑${meta.label}`}><Pencil size={17} /></button><button className="icon-button quick-copy" onClick={() => onCopy(meal)} title="复制到明天" aria-label={`复制${meta.label}到明天`}><ClipboardList size={18} /></button><OverflowMenu label={`${meta.label}更多操作`} actions={[{ label: "编辑餐次", icon: <Pencil size={16} />, onSelect: () => onEdit(meal) }, { label: "复制到明天", icon: <Copy size={16} />, onSelect: () => onCopy(meal) }, ...(meal.status === "confirmed" ? [{ label: "改回待确认", icon: <RefreshCw size={16} />, onSelect: () => onReset(meal.id) }] : []), { label: "删除此餐", icon: <Trash2 size={16} />, onSelect: () => onDelete(meal.id), danger: true }]} /></div></article>;
      })}<button className="empty-meal" onClick={() => onAdd("snack")}><Plus size={20} /><span><strong>从已有菜谱添加加餐</strong><small>预选加餐，可修改时间和参与成员</small></span></button></div>
    </div>
  );
}

function RecipesView({ recipes, search, setSearch, onFavorite, onEdit, onDuplicate, onDelete, onAdd, onUse }: { recipes: Recipe[]; search: string; setSearch: (value: string) => void; onFavorite: (id: string) => void; onEdit: (recipe: Recipe) => void; onDuplicate: (recipe: Recipe) => void; onDelete: (id: string) => void; onAdd: () => void; onUse: (recipe: Recipe) => void }) {
  const normalizedSearch = search.trim();
  const filtered = recipes.filter((recipe) => recipe.name.includes(normalizedSearch) || recipe.description.includes(normalizedSearch) || recipe.tags.some((tag) => tag.includes(normalizedSearch)) || recipe.ingredients.some((ingredient) => ingredient.food.name.includes(normalizedSearch)));
  return <div className="page-stack"><div className="page-toolbar"><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索菜名、食材、备注或标签" /></label><button className="primary-button" onClick={onAdd} aria-label="新建菜谱"><Plus size={18} />新建菜谱</button></div><div className="recipe-grid">{filtered.map((recipe, index) => { const total = calculateRecipe(recipe); return <article className="recipe-card" key={recipe.id}><div className={`recipe-visual visual-${index % 3}`}><span>{recipe.tags[0] ?? "自定义"}</span><Utensils size={36} /><button onClick={() => onFavorite(recipe.id)} className={recipe.favorite ? "favorite" : ""} aria-label={recipe.favorite ? "取消收藏" : "收藏"}><Heart size={19} fill={recipe.favorite ? "currentColor" : "none"} /></button></div><div className="recipe-body"><div className="recipe-title"><div><span className="eyebrow">{recipe.yieldServings} 份 · {recipe.ingredients.length} 种食材</span><h3>{recipe.name}</h3></div><OverflowMenu label={`${recipe.name}更多操作`} actions={[{ label: "编辑菜谱", icon: <Pencil size={16} />, onSelect: () => onEdit(recipe) }, { label: "安排到菜单", icon: <CalendarDays size={16} />, onSelect: () => onUse(recipe) }, { label: "复制菜谱", icon: <Copy size={16} />, onSelect: () => onDuplicate(recipe) }, { label: recipe.favorite ? "取消收藏" : "收藏菜谱", icon: <Heart size={16} />, onSelect: () => onFavorite(recipe.id) }, { label: "删除菜谱", icon: <Trash2 size={16} />, onSelect: () => onDelete(recipe.id), danger: true }]} /></div><p>{recipe.description || "暂无备注"}</p><div className="recipe-stats"><span><strong>{Math.round((total.energyKcal ?? 0) / recipe.yieldServings)}</strong> kcal/份</span><span><strong>{round((total.proteinG ?? 0) / recipe.yieldServings, 1)}</strong>g 蛋白质</span><span>{recipe.tags.join(" · ") || "无标签"}</span></div><div className="recipe-footer"><small>更新于 {recipe.updatedAt}</small><div className="recipe-footer-actions"><button className="edit-recipe" onClick={() => onEdit(recipe)}><Pencil size={15} />编辑</button><button onClick={() => onUse(recipe)}>安排菜单 <Plus size={16} /></button></div></div></div></article>; })}</div>{filtered.length === 0 && <div className="empty-state"><Search size={28} /><h3>没有找到相关菜谱</h3><p>换个关键词，或者新建一份菜谱。</p></div>}</div>;
}

function ShoppingView({ shopping, meals, initialDate, setShopping, notify }: { shopping: ShoppingItem[]; meals: Meal[]; initialDate: string; setShopping: React.Dispatch<React.SetStateAction<ShoppingItem[]>>; notify: (message: string) => void }) {
  const units: ShoppingItem["unit"][] = ["g", "kg", "ml", "L", "个", "包", "盒"];
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(addDays(initialDate, 2));
  const [newItem, setNewItem] = useState("");
  const [newAmount, setNewAmount] = useState("1");
  const [newUnit, setNewUnit] = useState<ShoppingItem["unit"]>("包");
  const [rangeError, setRangeError] = useState("");
  const completed = shopping.filter((item) => item.checked).length;
  const rangeMeals = endDate >= startDate ? meals.filter((meal) => meal.date >= startDate && meal.date <= endDate) : [];

  const add = () => {
    const name = newItem.trim();
    const amount = Number(newAmount);
    if (!name) {
      setRangeError("请先填写采购物品名称");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setRangeError("采购数量必须大于 0");
      return;
    }
    setShopping((items) => [...items, { id: `s-${Date.now()}`, name, amount, unit: newUnit, checked: false, source: "manual" }]);
    setNewItem("");
    setNewAmount("1");
    setRangeError("");
  };

  const regenerate = () => {
    try {
      const result = generateShoppingFromMeals(meals, startDate, endDate, shopping);
      setShopping(result.items);
      setRangeError("");
      notify(result.mealCount === 0 ? "所选日期没有菜单，已保留手工采购项" : `已从 ${result.mealCount} 餐菜单汇总 ${result.generatedCount} 种食材`);
    } catch (error) {
      setRangeError(error instanceof Error ? error.message : "无法生成采购清单");
    }
  };

  const updateAmount = (id: string, amount: number) => {
    setShopping((items) => items.map((item) => item.id === id ? { ...item, amount: Number.isFinite(amount) ? Math.max(0, amount) : item.amount } : item));
  };

  const updateUnit = (id: string, unit: ShoppingItem["unit"]) => {
    setShopping((items) => items.map((item) => item.id === id ? { ...item, amount: convertShoppingAmount(item.amount, item.unit, unit), unit } : item));
  };

  return (
    <div className="shopping-layout">
      <section className="shopping-hero">
        <div>
          <span className="eyebrow">{formatMenuDate(startDate)}—{formatMenuDate(endDate)}</span>
          <h2>采购清单</h2>
          <p>{rangeMeals.length} 餐菜单将参与汇总，可修改日期后重新生成。</p>
        </div>
        <div className="shopping-score"><strong>{completed}</strong><span>/ {shopping.length} 已购</span></div>
      </section>
      <section className="card shopping-list-card">
        <div className="card-heading"><div><span className="eyebrow">按菜单日期汇总</span><h3>待采购</h3></div></div>
        <div className="shopping-range">
          <label><span>开始日期</span><input type="date" value={startDate} onChange={(event) => event.target.value && setStartDate(event.target.value)} /></label>
          <label><span>结束日期</span><input type="date" value={endDate} onChange={(event) => event.target.value && setEndDate(event.target.value)} /></label>
          <button className="primary-button" onClick={regenerate}><RefreshCw size={15} />按最新菜单生成</button>
        </div>
        {rangeError && <p className="form-error"><CircleAlert size={14} />{rangeError}</p>}
        <div className="shopping-input">
          <input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} placeholder="手工添加，例如：酸奶" aria-label="采购物品名称" />
          <input className="shopping-add-amount" type="number" min="0.01" step="0.1" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} aria-label="采购数量" />
          <select value={newUnit} onChange={(event) => setNewUnit(event.target.value as ShoppingItem["unit"])} aria-label="采购单位">{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
          <button onClick={add}><Plus size={18} />添加</button>
        </div>
        <div className="shopping-items">
          {shopping.map((item) => (
            <div key={item.id} className={`shopping-item-row ${item.checked ? "checked" : ""}`}>
              <button className={`shopping-check ${item.checked ? "active" : ""}`} onClick={() => setShopping((items) => items.map((current) => current.id === item.id ? { ...current, checked: !current.checked } : current))} aria-label={item.checked ? `取消勾选${item.name}` : `勾选${item.name}`} aria-pressed={item.checked}><Check size={14} /></button>
              <span className="item-name"><strong>{item.name}</strong><small>{item.source === "generated" ? "来自所选菜单" : "手工添加"}</small></span>
              <div className="item-quantity">
                <input type="number" min="0.01" step="0.1" value={item.amount} onChange={(event) => updateAmount(item.id, event.target.valueAsNumber)} aria-label={`${item.name}采购数量`} />
                <select value={item.unit} onChange={(event) => updateUnit(item.id, event.target.value as ShoppingItem["unit"])} aria-label={`${item.name}采购单位`}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
              </div>
              <button className="shopping-delete" onClick={() => setShopping((items) => items.filter((current) => current.id !== item.id))} aria-label={`删除${item.name}`}><Trash2 size={17} /></button>
            </div>
          ))}
          {shopping.length === 0 && <div className="shopping-list-empty"><ShoppingBasket size={24} /><strong>清单还是空的</strong><span>选择包含菜单的日期范围，然后重新生成。</span></div>}
        </div>
      </section>
      <aside className="card shopping-tip">
        <div className="insight-icon"><Leaf size={20} /></div>
        <h3>与菜单保持同步</h3>
        <p>修改菜单后，选择日期范围并重新生成。系统会按实排份量合并同名食材；手工添加的项目和已购状态会保留。</p>
        <div className="source-legend"><span><i className="generated" />菜单生成 {shopping.filter((item) => item.source === "generated").length}</span><span><i className="manual" />手工添加 {shopping.filter((item) => item.source === "manual").length}</span></div>
      </aside>
    </div>
  );
}

function FamilyView({ householdName, members, selectedMember, setSelectedMemberId, vitals, setMembers, onEditHousehold, onAddMember, onEditMember, onAddVital, onManageData }: { householdName: string; members: Member[]; selectedMember: Member; setSelectedMemberId: (id: string) => void; vitals: VitalRecord[]; setMembers: React.Dispatch<React.SetStateAction<Member[]>>; onEditHousehold: () => void; onAddMember: () => void; onEditMember: (member: Member) => void; onAddVital: () => void; onManageData: () => void }) {
  const memberVitals = vitals.filter((vital) => vital.memberId === selectedMember.id);
  const weights = memberVitals.filter((vital) => vital.type === "weight");
  const goalLabel = selectedMember.goal === "lose" ? "减重" : selectedMember.goal === "gain" ? "增重" : "维持体重";
  return (
    <div className="family-layout">
      <section className="card family-list">
        <div className="card-heading"><div><span className="eyebrow">本机档案</span><div className="family-title-row"><h3>{householdName}</h3><button onClick={onEditHousehold} aria-label="编辑家庭名称" title="编辑家庭名称"><Pencil size={14} /></button></div></div><button className="round-button" onClick={onAddMember} aria-label="添加家庭成员"><Plus size={18} /></button></div>
        <div className="family-members">{members.map((member) => <button key={member.id} className={member.id === selectedMember.id ? "active" : ""} onClick={() => setSelectedMemberId(member.id)}><span className="avatar large">{member.avatar}</span><span><strong>{member.name}</strong><small>{member.relation}</small></span><span className={`share-dot ${member.healthShared ? "on" : ""}`} title={member.healthShared ? "参与本机营养统计" : "不参与本机营养统计"} /></button>)}</div>
        <div className="privacy-callout"><ShieldCheck size={18} /><p><strong>数据只保存在当前浏览器</strong>不会上传服务器；换手机前请先导出备份。</p></div>
      </section>
      <div className="family-main">
        <section className="profile-hero">
          <div className="profile-person"><span className="avatar xl">{selectedMember.avatar}</span><div><span className="eyebrow">{selectedMember.managed ? "代管档案" : "本人档案"}</span><h2>{selectedMember.name}</h2><p>{selectedMember.relation} · {selectedMember.heightCm}cm · {selectedMember.weightKg}kg</p></div></div>
          <button className="secondary-button" onClick={() => onEditMember(selectedMember)}><Settings size={17} />编辑档案</button>
          <div className="profile-facts"><div><span>活动量</span><strong>{selectedMember.activity === "high" ? "较高" : selectedMember.activity === "medium" ? "中等" : "较低"}</strong></div><div><span>体重目标</span><strong>{goalLabel}</strong></div><div><span>过敏/忌口</span><strong>{selectedMember.allergies.join("、") || "无"}</strong></div><div><span>参与统计</span><button className={`switch ${selectedMember.healthShared ? "on" : ""}`} onClick={() => setMembers((items) => items.map((item) => item.id === selectedMember.id ? { ...item, healthShared: !item.healthShared } : item))} aria-label={selectedMember.healthShared ? "停止参与统计" : "参与统计"} aria-pressed={selectedMember.healthShared}><span /></button></div></div>
        </section>
        <section className="card vitals-card">
          <div className="card-heading"><div><span className="eyebrow">最近 30 天</span><h3>体征趋势</h3></div><button className="primary-button small" onClick={onAddVital}><Plus size={16} />记录体征</button></div>
          <div className="vital-summary"><div><Weight size={20} /><span><small>最新体重</small><strong>{weights.at(-1)?.value ?? selectedMember.weightKg}<em> kg</em></strong></span><i className="trend-down">↓ 0.8kg</i></div><div><Activity size={20} /><span><small>最近血压</small><strong>{memberVitals.findLast((item) => item.type === "bloodPressure")?.value ?? "—"}<em> / {memberVitals.findLast((item) => item.type === "bloodPressure")?.secondaryValue ?? "—"}</em></strong></span><i>仅作记录</i></div></div>
          <div className="weight-chart" aria-label="体重趋势图">{weights.map((record, index) => <div key={record.id}><span style={{ height: `${50 + (record.value - 57) * 28}px` }} /><small>{index === weights.length - 1 ? "今天" : record.measuredAt.slice(5).replace("-", "/")}</small></div>)}</div>
        </section>
        <section className="card data-card"><div><ShieldCheck size={21} /><span><h3>本机数据管理</h3><p>可以导出完整备份、从另一台设备导入，或者清空当前浏览器里的全部记录。</p></span></div><div><button className="secondary-button" onClick={onManageData}><Download size={17} />导出或导入</button><button className="danger-button" onClick={onManageData}><Trash2 size={17} />清空数据</button></div></section>
      </div>
    </div>
  );
}

function LocalDataModal({ data, close, notify, onImport, onReset }: { data: LocalDataBundle; close: () => void; notify: (message: string) => void; onImport: (data: LocalDataBundle) => void; onReset: () => void }) {
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const exportData = () => {
    const blob = new Blob([createLocalBackup(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `禾味日历备份-${todayDateKey}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    notify("本机数据备份已导出");
  };
  const importData = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("备份文件不能超过 5MB");
      onImport(parseLocalBackup(await file.text()));
      notify("备份已导入并保存在本机");
      close();
    } catch (reason) {
      setError(reason instanceof Error ? `无法导入：${reason.message}` : "无法导入这个备份文件");
    }
  };
  const resetData = () => {
    if (!window.confirm("确定清空当前浏览器中的菜单、成员、菜谱、体征和购物记录吗？此操作无法撤销。")) return;
    window.localStorage.removeItem(LOCAL_DATA_KEY);
    onReset();
    notify("本机数据已恢复为初始内容");
    close();
  };
  return <AppModal title="本机数据管理" onClose={close}><div className="local-data-intro"><span className="login-symbol"><ShieldCheck size={28} /></span><h3>无需账号，也不上传云端</h3><p>网页会把菜单和健康记录保存在这个浏览器中。清理浏览器数据或更换设备前，请先导出备份。</p></div><div className="local-data-actions"><button className="primary-button" onClick={exportData}><Download size={17} />导出 JSON 备份</button><button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={17} />导入备份</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => importData(event.target.files?.[0])} /></div>{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<div className="local-data-danger"><div><strong>恢复初始数据</strong><p>删除当前浏览器中保存的全部修改，并恢复示例菜单。</p></div><button className="danger-button" onClick={resetData}><Trash2 size={17} />清空</button></div></AppModal>;
}

function MemberChecklist({ members, selectedIds, onChange }: { members: Member[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (memberId: string) => onChange(selectedIds.includes(memberId) ? selectedIds.filter((id) => id !== memberId) : [...selectedIds, memberId]);
  return <fieldset className="member-checklist"><legend>参与成员</legend><div>{members.map((member) => <label key={member.id} className={selectedIds.includes(member.id) ? "selected" : ""}><input type="checkbox" checked={selectedIds.includes(member.id)} onChange={() => toggle(member.id)} /><span className="avatar">{member.avatar}</span><span><strong>{member.name}</strong><small>{member.relation}</small></span><Check size={16} /></label>)}</div></fieldset>;
}

function MealPlacementModal({ recipes, members, selectedDate, initialRecipeId, initialSlot, close, addMeal }: { recipes: Recipe[]; members: Member[]; selectedDate: string; initialRecipeId: string | null; initialSlot: MealSlot | null; close: () => void; addMeal: (recipe: Recipe, slot: MealSlot, time: string, participantIds: string[]) => void }) {
  const [recipeId, setRecipeId] = useState(() => recipes.some((recipe) => recipe.id === initialRecipeId) ? initialRecipeId! : recipes[0]?.id ?? "");
  const [slot, setSlot] = useState<MealSlot>(initialSlot ?? "dinner");
  const [time, setTime] = useState(defaultMealTimes[initialSlot ?? "dinner"]);
  const [participantIds, setParticipantIds] = useState(() => members.map((member) => member.id));
  const [error, setError] = useState("");
  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);
  const save = () => {
    if (!selectedRecipe) return setError("请选择一个已有菜谱");
    if (!/^\d{2}:\d{2}$/.test(time)) return setError("请选择用餐时间");
    if (participantIds.length === 0) return setError("请至少选择一位参与成员");
    addMeal(selectedRecipe, slot, time, participantIds);
  };
  return <AppModal title="从已有菜谱添加到菜单" onClose={close} wide>{recipes.length === 0 ? <div className="empty-state"><Utensils size={28} /><h3>还没有可用菜谱</h3><p>请先到菜谱页创建菜谱，再返回菜单安排餐食。</p><button className="primary-button" onClick={close}>知道了</button></div> : <><div className="meal-placement-date"><CalendarDays size={18} /><span>安排到<strong>{formatMenuDate(selectedDate)}</strong></span></div><div className="meal-recipe-picker" role="radiogroup" aria-label="选择已有菜谱">{recipes.map((recipe) => { const total = calculateRecipe(recipe); return <button key={recipe.id} type="button" role="radio" aria-checked={recipe.id === recipeId} className={recipe.id === recipeId ? "selected" : ""} onClick={() => setRecipeId(recipe.id)}><span className="food-thumb"><Utensils size={21} /></span><span><strong>{recipe.name}</strong><small>{recipe.tags.join(" · ") || `${recipe.ingredients.length} 种食材`}</small></span><em>{Math.round((total.energyKcal ?? 0) / recipe.yieldServings)} kcal/份</em><Check size={17} /></button>; })}</div><div className="form-grid meal-arrangement-fields"><label className="field"><span>餐别</span><select value={slot} onChange={(event) => { const next = event.target.value as MealSlot; setSlot(next); setTime(defaultMealTimes[next]); }}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select></label><label className="field"><span>用餐时间</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div><MemberChecklist members={members} selectedIds={participantIds} onChange={setParticipantIds} />{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={close}>取消</button><button className="primary-button" onClick={save}><Plus size={17} />加入菜单</button></div></>}</AppModal>;
}

function MealEditModal({ meal, members, close, saveMeal }: { meal: Meal; members: Member[]; close: () => void; saveMeal: (meal: Meal) => void }) {
  const [slot, setSlot] = useState<MealSlot>(meal.slot);
  const [time, setTime] = useState(meal.time);
  const [participantIds, setParticipantIds] = useState(meal.participantIds);
  const [error, setError] = useState("");
  const recipeName = meal.dishes.map((dish) => dish.recipeSnapshot.name).join("、") || "未命名菜品";
  const save = () => {
    if (!/^\d{2}:\d{2}$/.test(time)) return setError("请选择用餐时间");
    if (participantIds.length === 0) return setError("请至少选择一位参与成员");
    saveMeal({ ...meal, slot, time, participantIds, dishes: meal.dishes.map((dish) => ({ ...dish, allocations: Object.fromEntries(participantIds.map((memberId) => [memberId, dish.allocations[memberId] ?? 1])) })) });
  };
  return <AppModal title={`编辑餐次 · ${recipeName}`} onClose={close}><div className="meal-placement-date"><CalendarDays size={18} /><span>{formatMenuDate(meal.date)} · <strong>{recipeName}</strong></span></div><div className="form-grid meal-arrangement-fields"><label className="field"><span>餐别</span><select value={slot} onChange={(event) => { const next = event.target.value as MealSlot; setSlot(next); setTime(defaultMealTimes[next]); }}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select></label><label className="field"><span>用餐时间</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div><MemberChecklist members={members} selectedIds={participantIds} onChange={setParticipantIds} />{meal.status === "confirmed" && <div className="reference-note"><Info size={16} /><p>这是已确认的餐次。保存修改后会改回待确认，避免直接改变实际摄入统计。</p></div>}{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={close}>取消</button><button className="primary-button" onClick={save}><Check size={17} />保存餐次</button></div></AppModal>;
}

function RecipeEditModal({ recipe, close, saveRecipe }: { recipe: Recipe; close: () => void; saveRecipe: (recipe: Recipe) => void }) {
  const [draft, setDraft] = useState<Recipe>(() => structuredClone(recipe));
  const [error, setError] = useState("");
  const updateIngredient = (index: number, update: (ingredient: Recipe["ingredients"][number]) => Recipe["ingredients"][number]) => {
    setDraft((current) => ({ ...current, ingredients: current.ingredients.map((ingredient, ingredientIndex) => ingredientIndex === index ? update(ingredient) : ingredient) }));
  };
  const updateIngredientNutrient = (index: number, key: "energyKcal" | "proteinG" | "fatG" | "carbohydrateG", value: string) => {
    updateIngredient(index, (current) => ({
      ...current,
      food: {
        ...current.food,
        source: "custom",
        sourceId: undefined,
        sourceVersion: todayDateKey,
        nutrientsPer100g: { ...current.food.nutrientsPer100g, [key]: value === "" ? null : Number(value) },
      },
    }));
  };
  const addIngredient = () => {
    const id = `ingredient-${Date.now()}-${draft.ingredients.length}`;
    setDraft((current) => ({
      ...current,
      ingredients: [...current.ingredients, {
        id,
        amountG: 100,
        edibleRatio: 1,
        food: {
          id: `food-${id}`,
          name: "新食材",
          aliases: [],
          state: "raw",
          source: "custom",
          sourceVersion: todayDateKey,
          nutrientsPer100g: { ...customNutrition(0), energyKcal: null },
        },
      }],
    }));
  };
  const save = () => {
    const name = draft.name.trim();
    if (!name) return setError("请输入菜名");
    if (!Number.isFinite(draft.yieldServings) || draft.yieldServings <= 0) return setError("出品份数必须大于 0");
    if (draft.finishedWeightG !== undefined && (!Number.isFinite(draft.finishedWeightG) || draft.finishedWeightG <= 0)) return setError("成品重量必须大于 0，或者留空");
    if (draft.ingredients.length === 0) return setError("菜谱至少需要一种食材");
    const invalid = draft.ingredients.find((ingredient) => {
      const nutritionValues = [ingredient.food.nutrientsPer100g.energyKcal, ingredient.food.nutrientsPer100g.proteinG, ingredient.food.nutrientsPer100g.fatG, ingredient.food.nutrientsPer100g.carbohydrateG];
      return !ingredient.food.name.trim() || !Number.isFinite(ingredient.amountG) || ingredient.amountG <= 0 || !Number.isFinite(ingredient.edibleRatio) || ingredient.edibleRatio <= 0 || ingredient.edibleRatio > 1 || nutritionValues.some((value) => value !== null && (!Number.isFinite(value) || value < 0));
    });
    if (invalid) return setError("请检查每种食材的名称、重量、可食比例和每 100g 营养");
    saveRecipe({ ...draft, name, description: draft.description.trim(), updatedAt: "刚刚" });
  };
  return <AppModal title={`编辑菜谱 · ${recipe.name}`} onClose={close} wide><div className="form-grid recipe-edit-basics"><label className="field span-two"><span>菜名</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus /></label><label className="field span-two"><span>备注 / 菜谱说明</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} placeholder="记录做法、口味、注意事项或适合的场景" /></label><label className="field"><span>出品份数</span><input type="number" min="0.1" step="0.1" value={draft.yieldServings} onChange={(event) => setDraft({ ...draft, yieldServings: Number(event.target.value) })} /></label><label className="field"><span>成品重量（g，可选）</span><input type="number" min="1" value={draft.finishedWeightG ?? ""} onChange={(event) => setDraft({ ...draft, finishedWeightG: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field span-two"><span>标签（用顿号或逗号分隔）</span><input value={draft.tags.join("、")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(/[、,，]/).map((tag) => tag.trim()).filter(Boolean) })} placeholder="例如：家常、快手、高蛋白" /></label></div><div className="ingredient-editor-heading"><div><span className="eyebrow">食材明细</span><h3>{draft.ingredients.length} 种食材</h3></div><button className="secondary-button" onClick={addIngredient}><Plus size={16} />添加食材</button></div><div className="ingredient-editor-list">{draft.ingredients.map((ingredient, index) => <section className="ingredient-editor" key={ingredient.id}><div className="ingredient-editor-title"><strong>食材 {index + 1}</strong><button onClick={() => setDraft((current) => ({ ...current, ingredients: current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index) }))} aria-label={`删除${ingredient.food.name}`}><Trash2 size={16} /></button></div><div className="ingredient-editor-grid"><label className="field"><span>食材名称</span><input value={ingredient.food.name} onChange={(event) => updateIngredient(index, (current) => ({ ...current, food: { ...current.food, name: event.target.value, source: "custom", sourceId: undefined, sourceVersion: todayDateKey } }))} /></label><label className="field"><span>状态</span><select value={ingredient.food.state} onChange={(event) => updateIngredient(index, (current) => ({ ...current, food: { ...current.food, state: event.target.value as typeof current.food.state, source: "custom", sourceId: undefined, sourceVersion: todayDateKey } }))}><option value="raw">生鲜/原始</option><option value="cooked">熟制</option><option value="packaged">包装食品</option></select></label><label className="field"><span>重量（g）</span><input type="number" min="0.1" step="0.1" value={ingredient.amountG} onChange={(event) => updateIngredient(index, (current) => ({ ...current, amountG: Number(event.target.value) }))} /></label><label className="field"><span>可食比例（%）</span><input type="number" min="1" max="100" value={round(ingredient.edibleRatio * 100, 1)} onChange={(event) => updateIngredient(index, (current) => ({ ...current, edibleRatio: Number(event.target.value) / 100 }))} /></label></div><div className="ingredient-nutrition-heading"><strong>每 100g 营养</strong><span>留空表示数据不完整，不会按 0 计算</span></div><div className="ingredient-nutrition-grid"><label className="field"><span>热量（kcal）</span><input type="number" min="0" step="0.1" value={ingredient.food.nutrientsPer100g.energyKcal ?? ""} onChange={(event) => updateIngredientNutrient(index, "energyKcal", event.target.value)} /></label><label className="field"><span>蛋白质（g）</span><input type="number" min="0" step="0.1" value={ingredient.food.nutrientsPer100g.proteinG ?? ""} onChange={(event) => updateIngredientNutrient(index, "proteinG", event.target.value)} /></label><label className="field"><span>脂肪（g）</span><input type="number" min="0" step="0.1" value={ingredient.food.nutrientsPer100g.fatG ?? ""} onChange={(event) => updateIngredientNutrient(index, "fatG", event.target.value)} /></label><label className="field"><span>碳水化合物（g）</span><input type="number" min="0" step="0.1" value={ingredient.food.nutrientsPer100g.carbohydrateG ?? ""} onChange={(event) => updateIngredientNutrient(index, "carbohydrateG", event.target.value)} /></label></div></section>)}</div><div className="reference-note"><Info size={16} /><p>餐别、用餐时间和参与成员请在菜单页设置。保存菜谱后会重新计算营养；已经安排或确认的餐食继续使用当时的菜谱快照。</p></div>{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={close}>取消</button><button className="primary-button" onClick={save}><Check size={17} />保存修改</button></div></AppModal>;
}

function RecipeModal({ close, addRecipe }: { close: () => void; addRecipe: (recipe: Recipe) => void }) {
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", tags: "自定义", ingredientName: "", amountG: "", yieldServings: "3", energy: "", protein: "", fat: "", carbohydrate: "", state: "raw" as "raw" | "cooked" | "packaged" });
  const optionalNutrient = (value: string) => value.trim() === "" ? null : Number(value);
  const save = () => {
    const parsed = recipeSchema.safeParse(form);
    const energyParsed = z.coerce.number().nonnegative().safeParse(form.energy);
    const optionalValues = [form.protein, form.fat, form.carbohydrate].map(optionalNutrient);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (!form.energy.trim() || !energyParsed.success) return setError("请输入每 100g 热量");
    if (optionalValues.some((value) => value !== null && (!Number.isFinite(value) || value < 0))) return setError("三大营养素必须是大于等于 0 的数字，或留空");
    const now = new Date();
    addRecipe({ id: `recipe-${now.getTime()}`, name: parsed.data.name, description: form.description.trim(), favorite: false, yieldServings: parsed.data.yieldServings, finishedWeightG: parsed.data.amountG, tags: form.tags.split(/[、,，]/).map((tag) => tag.trim()).filter(Boolean), updatedAt: "刚刚", ingredients: [{ id: `ingredient-${now.getTime()}`, amountG: parsed.data.amountG, edibleRatio: 1, food: { id: `food-${now.getTime()}`, name: parsed.data.ingredientName, aliases: [], state: form.state, source: "custom", sourceVersion: now.toISOString().slice(0, 10), nutrientsPer100g: customNutrition(energyParsed.data, optionalValues[0], optionalValues[1], optionalValues[2]) } }] });
  };
  return <AppModal title="手工创建菜谱" onClose={close} wide><div className="manual-entry-note"><Utensils size={18} /><div><strong>手工录入菜谱</strong><p>填写菜名、食材重量和营养数据，保存后仍可添加更多食材或继续编辑。</p></div></div><div className="form-grid"><label className="field"><span>菜名</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：番茄炒蛋" /></label><label className="field"><span>主要食材</span><input value={form.ingredientName} onChange={(event) => setForm({ ...form, ingredientName: event.target.value })} placeholder="例如：番茄" /></label><label className="field span-two"><span>备注 / 菜谱说明</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} placeholder="记录做法、口味或注意事项" /></label><label className="field span-two"><span>标签（用顿号或逗号分隔）</span><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="例如：家常、快手、高蛋白" /></label><label className="field"><span>食材重量（g）</span><input type="number" value={form.amountG} onChange={(event) => setForm({ ...form, amountG: event.target.value })} placeholder="请输入重量" /></label><label className="field"><span>出品份数</span><input type="number" value={form.yieldServings} onChange={(event) => setForm({ ...form, yieldServings: event.target.value })} /></label><label className="field"><span>食材状态</span><select value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value as typeof form.state })}><option value="raw">生鲜/原始</option><option value="cooked">熟制</option><option value="packaged">包装食品</option></select></label><span className="field nutrition-group-label"><span>以下均为每 100g，可从包装标签录入</span></span><label className="field"><span>热量（kcal）</span><input type="number" min="0" step="0.1" value={form.energy} onChange={(event) => setForm({ ...form, energy: event.target.value })} placeholder="必填" /></label><label className="field"><span>蛋白质（g）</span><input type="number" min="0" step="0.1" value={form.protein} onChange={(event) => setForm({ ...form, protein: event.target.value })} placeholder="可留空" /></label><label className="field"><span>脂肪（g）</span><input type="number" min="0" step="0.1" value={form.fat} onChange={(event) => setForm({ ...form, fat: event.target.value })} placeholder="可留空" /></label><label className="field"><span>碳水化合物（g）</span><input type="number" min="0" step="0.1" value={form.carbohydrate} onChange={(event) => setForm({ ...form, carbohydrate: event.target.value })} placeholder="可留空" /></label></div>{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={close}>取消</button><button className="primary-button" onClick={save}><Check size={17} />确认并保存</button></div></AppModal>;
}

function HouseholdNameModal({ householdName, close, saveName }: { householdName: string; close: () => void; saveName: (name: string) => void }) {
  const [name, setName] = useState(householdName);
  const [error, setError] = useState("");
  const save = () => {
    const normalized = name.trim();
    if (!normalized) return setError("请输入家庭名称");
    if (normalized.length > 30) return setError("家庭名称不能超过 30 个字符");
    saveName(normalized);
  };
  return <AppModal title="编辑家庭名称" onClose={close}><label className="field"><span>家庭名称</span><input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && save()} placeholder="例如：三木的小家" autoFocus /><small>{name.length}/30 个字符</small></label>{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<div className="reference-note"><Info size={16} /><p>家庭名称只用于当前浏览器中的家庭页面和数据备份，不会公开显示。</p></div><div className="modal-actions"><button className="secondary-button" onClick={close}>取消</button><button className="primary-button" onClick={save}><Check size={17} />保存名称</button></div></AppModal>;
}

function MemberEditModal({ member, close, saveMember }: { member: Member; close: () => void; saveMember: (member: Member) => void }) {
  const [form, setForm] = useState({
    name: member.name,
    relation: member.relation,
    birthday: member.birthday,
    driSex: member.driSex,
    heightCm: String(member.heightCm || ""),
    weightKg: String(member.weightKg || ""),
    activity: member.activity,
    goal: member.goal,
    allergies: member.allergies.join("、"),
  });
  const [error, setError] = useState("");
  const save = () => {
    const parsed = memberProfileSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (parsed.data.birthday > todayDateKey) return setError("出生日期不能晚于今天");
    saveMember({
      ...member,
      ...parsed.data,
      avatar: parsed.data.name.slice(0, 1),
      allergies: form.allergies.split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
    });
  };
  return <AppModal title={`编辑${member.name}的档案`} onClose={close} wide><div className="form-grid member-profile-form"><label className="field"><span>姓名或昵称</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus /></label><label className="field"><span>家庭关系</span><input value={form.relation} onChange={(event) => setForm({ ...form, relation: event.target.value })} placeholder="例如：我、伴侣、女儿" /></label><label className="field"><span>出生日期</span><input type="date" max={todayDateKey} value={form.birthday} onChange={(event) => setForm({ ...form, birthday: event.target.value })} /></label><label className="field"><span>DRI 计算性别</span><select value={form.driSex} onChange={(event) => setForm({ ...form, driSex: event.target.value as Member["driSex"] })}><option value="female">女性</option><option value="male">男性</option></select></label><label className="field"><span>身高（cm）</span><input type="number" min="30" max="250" step="0.1" value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: event.target.value })} /></label><label className="field"><span>体重（kg）</span><input type="number" min="1" max="500" step="0.1" value={form.weightKg} onChange={(event) => setForm({ ...form, weightKg: event.target.value })} /></label><label className="field"><span>日常活动量</span><select value={form.activity} onChange={(event) => setForm({ ...form, activity: event.target.value as Member["activity"] })}><option value="low">较低</option><option value="medium">中等</option><option value="high">较高</option></select></label><label className="field"><span>体重目标</span><select value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value as Member["goal"] })}><option value="maintain">维持体重</option><option value="lose">减重</option><option value="gain">增重</option></select></label><label className="field span-two"><span>过敏 / 忌口（用顿号或逗号分隔）</span><input value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} placeholder="例如：花生、虾；没有可留空" /></label></div><div className="reference-note"><Info size={16} /><p>这些信息用于家庭营养记录和参考值展示，不作疾病诊断，也不会自动调整热量目标。</p></div>{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={close}>取消</button><button className="primary-button" onClick={save}><Check size={17} />保存档案</button></div></AppModal>;
}

function MemberModal({ close, addMember }: { close: () => void; addMember: (member: Member) => void }) {
  const [form, setForm] = useState({ name: "", relation: "", birthday: "", driSex: "female" }); const [error, setError] = useState("");
  const save = () => { const parsed = memberSchema.safeParse(form); if (!parsed.success) return setError(parsed.error.issues[0].message); addMember({ id: `member-${Date.now()}`, name: parsed.data.name, relation: parsed.data.relation, avatar: parsed.data.name.slice(0, 1), managed: true, healthShared: true, birthday: parsed.data.birthday, driSex: parsed.data.driSex, heightCm: 0, weightKg: 0, activity: "medium", goal: "maintain", allergies: [] }); };
  return <AppModal title="添加代管家庭成员" onClose={close}><div className="form-stack"><label className="field"><span>姓名或昵称</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus /></label><label className="field"><span>家庭关系</span><input value={form.relation} onChange={(event) => setForm({ ...form, relation: event.target.value })} placeholder="例如：儿子、奶奶" /></label><label className="field"><span>出生日期</span><input type="date" value={form.birthday} onChange={(event) => setForm({ ...form, birthday: event.target.value })} /></label><label className="field"><span>DRI 计算性别</span><select value={form.driSex} onChange={(event) => setForm({ ...form, driSex: event.target.value })}><option value="female">女性</option><option value="male">男性</option></select><small>仅用于匹配膳食参考值，不作为公开身份标签。</small></label></div>{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<div className="consent-box"><ShieldCheck size={18} /><p>为未成年人建档时，请确认你是其监护人或已获得监护人同意。</p></div><button className="primary-button full" onClick={save}>创建代管档案</button></AppModal>;
}

function VitalModal({ member, close, addVital }: { member: Member; close: () => void; addVital: (record: VitalRecord) => void }) {
  const [type, setType] = useState<VitalRecord["type"]>("weight"); const [value, setValue] = useState(""); const [secondary, setSecondary] = useState(""); const unit = type === "weight" ? "kg" : type === "bodyFat" ? "%" : type === "bloodPressure" ? "mmHg" : "mmol/L";
  const save = () => { const number = Number(value); if (!Number.isFinite(number) || number <= 0) return; addVital({ id: `vital-${Date.now()}`, memberId: member.id, type, value: number, secondaryValue: secondary ? Number(secondary) : undefined, unit, measuredAt: new Date().toISOString().slice(0, 10) }); };
  return <AppModal title={`记录${member.name}的体征`} onClose={close}><div className="vital-types">{(["weight", "bodyFat", "bloodPressure", "bloodGlucose"] as const).map((item) => <button className={type === item ? "active" : ""} key={item} onClick={() => setType(item)}>{item === "weight" ? "体重" : item === "bodyFat" ? "体脂" : item === "bloodPressure" ? "血压" : "血糖"}</button>)}</div><label className="field"><span>{type === "bloodPressure" ? "收缩压" : "测量值"}（{unit}）</span><input type="number" value={value} onChange={(event) => setValue(event.target.value)} autoFocus /></label>{type === "bloodPressure" && <label className="field"><span>舒张压（mmHg）</span><input type="number" value={secondary} onChange={(event) => setSecondary(event.target.value)} /></label>}<div className="reference-note"><Info size={16} /><p>这里只记录趋势，不提供诊断、用药或疾病营养建议。</p></div><button className="primary-button full" onClick={save}>保存记录</button></AppModal>;
}
