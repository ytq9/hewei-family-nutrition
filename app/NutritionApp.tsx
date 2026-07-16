"use client";
/* eslint-disable @next/next/no-img-element */

import {
  Activity,
  Apple,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  Download,
  Heart,
  Home,
  Info,
  Leaf,
  Mail,
  MoreHorizontal,
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
import { emailSchema, memberSchema, otpSchema, recipeSchema } from "./lib/app-schemas";
import {
  analyzeIngredientPhoto,
  cloudbaseConfigured,
  sendEmailOtp,
  uploadIngredientPhoto,
  verifyEmailOtp,
} from "./lib/cloudbase-client";
import {
  driTargets,
  initialMeals,
  initialMembers,
  initialRecipes,
  initialShopping,
  initialVitals,
  weekDays,
} from "./lib/demo-data";
import {
  allocateRecipe,
  calculateRecipe,
  getNutritionStatus,
  normalizeShoppingAmount,
  sumVectors,
} from "./lib/nutrition";
import { nutrientKeys } from "./lib/types";
import type {
  Meal,
  Member,
  NutrientKey,
  NutrientVector,
  Recipe,
  ShoppingItem,
  VitalRecord,
} from "./lib/types";

type TabId = "home" | "menu" | "recipes" | "shopping" | "family";
type ModalId = "login" | "recipe" | "member" | "vital" | "install" | null;

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

const slotMeta = {
  breakfast: { label: "早餐", icon: "晨", color: "amber" },
  lunch: { label: "午餐", icon: "午", color: "green" },
  dinner: { label: "晚餐", icon: "暮", color: "coral" },
  snack: { label: "加餐", icon: "点", color: "blue" },
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

const customNutrition = (energy: number): NutrientVector => ({
  energyKcal: energy,
  proteinG: null,
  fatG: null,
  carbohydrateG: null,
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

async function compressPhoto(file: File) {
  if (!/image\/(jpeg|png)/.test(file.type)) throw new Error("仅支持 JPEG 或 PNG 图片");
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("图片无法读取"));
      element.src = sourceUrl;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("图片压缩失败")), "image/jpeg", 0.86),
    );
    if (blob.size > 5 * 1024 * 1024) throw new Error("压缩后图片仍超过 5MB，请换一张照片");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

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

export default function NutritionApp() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [members, setMembers] = useState(initialMembers);
  const [selectedMemberId, setSelectedMemberId] = useState(initialMembers[0].id);
  const [recipes, setRecipes] = useState(initialRecipes);
  const [meals, setMeals] = useState(initialMeals);
  const [shopping, setShopping] = useState(initialShopping);
  const [vitals, setVitals] = useState(initialVitals);
  const [modal, setModal] = useState<ModalId>(null);
  const [toast, setToast] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [mealView, setMealView] = useState<"today" | "week">("today");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const isOnline = useSyncExternalStore(subscribeToConnectivity, getOnlineSnapshot, getServerOnlineSnapshot);
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? members[0];

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
      .filter((meal) => meal.status === "confirmed" && meal.participantIds.includes(selectedMemberId))
      .flatMap((meal) => meal.dishes)
      .map((dish) => allocateRecipe(dish.recipeSnapshot, dish.allocationMode, dish.allocations[selectedMemberId] ?? 0));
    return vectors.length ? sumVectors(vectors) : Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as NutrientVector;
  }, [meals, selectedMemberId]);

  const plannedNutrition = useMemo(() => {
    const vectors = meals
      .filter((meal) => meal.participantIds.includes(selectedMemberId))
      .flatMap((meal) => meal.dishes)
      .map((dish) => allocateRecipe(dish.recipeSnapshot, dish.allocationMode, dish.allocations[selectedMemberId] ?? 0));
    return vectors.length ? sumVectors(vectors) : Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as NutrientVector;
  }, [meals, selectedMemberId]);

  const statuses = useMemo(
    () => nutrientKeys.map((key) => getNutritionStatus(actualNutrition[key], { key, target: driTargets[key], upper: key === "sodiumMg" ? 2000 : undefined })),
    [actualNutrition],
  );

  const notify = (message: string) => setToast(message);

  const confirmMeal = (mealId: string) => {
    setMeals((current) => current.map((meal) => meal.id === mealId ? { ...meal, status: "confirmed" } : meal));
    notify("已计入今日实际摄入");
  };

  const copyMeal = (meal: Meal) => {
    const newMeal: Meal = { ...meal, id: `${meal.id}-${Date.now()}`, date: "2026-07-17", status: "planned" };
    setMeals((current) => [...current, newMeal]);
    notify("已复制到明天");
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
    if (activeTab === "menu") return <MenuView meals={meals} members={members} mode={mealView} setMode={setMealView} onConfirm={confirmMeal} onCopy={copyMeal} onAdd={() => setModal("recipe")} />;
    if (activeTab === "recipes") return <RecipesView recipes={recipes} search={recipeSearch} setSearch={setRecipeSearch} onFavorite={(id) => setRecipes((current) => current.map((recipe) => recipe.id === id ? { ...recipe, favorite: !recipe.favorite } : recipe))} onAdd={() => setModal("recipe")} onUse={(recipe) => { setActiveTab("menu"); notify(`${recipe.name} 已加入今晚菜单`); }} />;
    if (activeTab === "shopping") return <ShoppingView shopping={shopping} setShopping={setShopping} notify={notify} />;
    if (activeTab === "family") return <FamilyView members={members} selectedMember={selectedMember} setSelectedMemberId={setSelectedMemberId} vitals={vitals} setMembers={setMembers} onAddMember={() => setModal("member")} onAddVital={() => setModal("vital")} notify={notify} />;
    return <HomeView selectedMember={selectedMember} members={members} setSelectedMemberId={setSelectedMemberId} actualNutrition={actualNutrition} plannedNutrition={plannedNutrition} statuses={statuses} meals={meals} onConfirm={confirmMeal} onScan={() => setModal("recipe")} onNavigate={setActiveTab} />;
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
          <Sparkles size={18} />
          <strong>让记录更轻松</strong>
          <p>拍下食材，AI 帮你预填名称与营养标签。</p>
          <button onClick={() => setModal("recipe")}>拍照识别</button>
        </div>
        <div className="sidebar-foot">
          <button onClick={handleInstall}><Download size={18} />安装到桌面</button>
          <button onClick={() => setModal("login")}><Settings size={18} />云端设置</button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">2026 年 7 月 16 日 · 星期四</span>
            <h1>{navItems.find((item) => item.id === activeTab)?.label ?? "首页"}</h1>
          </div>
          <div className="top-actions">
            {!isOnline && <span className="offline-pill"><CircleAlert size={15} />离线</span>}
            <span className={`mode-pill ${cloudbaseConfigured ? "live" : ""}`}><span />{cloudbaseConfigured ? "CloudBase 已连接" : "体验模式"}</span>
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

      <button className="mobile-fab" onClick={() => setModal("recipe")} aria-label="拍照添加食材"><Camera size={23} /></button>
      {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}

      {modal === "login" && <LoginModal close={() => setModal(null)} notify={notify} />}
      {modal === "recipe" && <RecipeModal close={() => setModal(null)} addRecipe={(recipe) => { setRecipes((current) => [recipe, ...current]); setModal(null); notify("菜谱已保存"); }} />}
      {modal === "member" && <MemberModal close={() => setModal(null)} addMember={(member) => { setMembers((current) => [...current, member]); setModal(null); notify("家庭成员已添加"); }} />}
      {modal === "vital" && <VitalModal member={selectedMember} close={() => setModal(null)} addVital={(record) => { setVitals((current) => [...current, record]); setModal(null); notify("体征记录已保存"); }} />}
      {modal === "install" && <AppModal title="添加到手机主屏幕" onClose={() => setModal(null)}><div className="install-steps"><div><span>1</span><p><strong>iPhone Safari</strong>点击分享按钮，再选择“添加到主屏幕”。</p></div><div><span>2</span><p><strong>Android Chrome</strong>打开浏览器菜单，选择“安装应用”。</p></div><div><span>3</span><p><strong>电脑浏览器</strong>点击地址栏右侧的安装图标。</p></div></div><button className="primary-button full" onClick={() => setModal(null)}>知道了</button></AppModal>}
    </div>
  );
}

function HomeView({ selectedMember, members, setSelectedMemberId, actualNutrition, plannedNutrition, statuses, meals, onConfirm, onScan, onNavigate }: {
  selectedMember: Member; members: Member[]; setSelectedMemberId: (id: string) => void; actualNutrition: NutrientVector; plannedNutrition: NutrientVector; statuses: ReturnType<typeof getNutritionStatus>[]; meals: Meal[]; onConfirm: (id: string) => void; onScan: () => void; onNavigate: (tab: TabId) => void;
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
          <div className="hero-actions"><button onClick={() => onNavigate("menu")}>查看今日菜单 <ChevronRight size={17} /></button><button className="ghost" onClick={onScan}><Camera size={17} />拍食材</button></div>
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
        <div className="meal-list">{meals.filter((meal) => meal.date === meals[0]?.date).map((meal) => {
          const meta = slotMeta[meal.slot];
          const recipe = meal.dishes[0]?.recipeSnapshot;
          const total = recipe ? calculateRecipe(recipe) : null;
          return <article className="meal-item" key={meal.id}><span className={`meal-icon ${meta.color}`}>{meta.icon}</span><div><span>{meta.label} · {meal.time}</span><strong>{recipe?.name ?? "尚未安排"}</strong><small>{total ? `${Math.round((total.energyKcal ?? 0) / recipe.yieldServings)} kcal / 份` : "点击添加菜品"}</small></div>{meal.status === "confirmed" ? <span className="status confirmed"><Check size={14} />已确认</span> : <button className="status planned" onClick={() => onConfirm(meal.id)}>确认实吃</button>}</article>;
        })}</div>
      </section>

      <button className="scan-card" onClick={onScan}>
        <span className="scan-icon"><Camera size={27} /></span><span><small>食材不知道怎么录？</small><strong>拍一下，AI 帮你预填</strong><em>名称、净含量与营养标签都可修改</em></span><ChevronRight size={20} />
      </button>

      <section className="card insight-card"><div className="insight-icon"><Sparkles size={20} /></div><div><span className="eyebrow">今日小提示</span><h3>晚餐加一份深色蔬菜</h3><p>按计划完成晚餐后，钙和膳食纤维仍略低。可以加 100g 菠菜或小油菜。</p></div><button onClick={() => onNavigate("recipes")}>找菜谱</button></section>
    </div>
  );
}

function MenuView({ meals, members, mode, setMode, onConfirm, onCopy, onAdd }: { meals: Meal[]; members: Member[]; mode: "today" | "week"; setMode: (mode: "today" | "week") => void; onConfirm: (id: string) => void; onCopy: (meal: Meal) => void; onAdd: () => void }) {
  return (
    <div className="page-stack">
      <div className="page-toolbar"><div className="segmented"><button className={mode === "today" ? "active" : ""} onClick={() => setMode("today")}>今日餐单</button><button className={mode === "week" ? "active" : ""} onClick={() => setMode("week")}>本周计划</button></div><button className="primary-button" onClick={onAdd}><Plus size={18} />添加菜品</button></div>
      <section className="week-strip"><button className="icon-button"><ChevronLeft size={19} /></button>{weekDays.map((item) => <button key={item.date} className={item.current ? "active" : ""}><span>{item.day}</span><strong>{item.date}</strong>{item.current && <i />}</button>)}<button className="icon-button"><ChevronRight size={19} /></button></section>
      <div className={mode === "week" ? "week-plan" : "meal-plan"}>{meals.map((meal) => {
        const meta = slotMeta[meal.slot];
        const recipe = meal.dishes[0]?.recipeSnapshot;
        return <article className="plan-card" key={meal.id}><div className="plan-time"><span className={`meal-icon ${meta.color}`}>{meta.icon}</span><div><strong>{meta.label}</strong><small><Clock3 size={14} />{meal.time}</small></div></div><div className="plan-food"><div className="food-thumb"><Apple size={26} /></div><div><span className="eyebrow">{recipe?.tags.join(" · ")}</span><h3>{recipe?.name}</h3><p>{recipe?.ingredients.map((ingredient) => ingredient.food.name).join("、")}</p><div className="participant-stack">{meal.participantIds.map((id) => { const member = members.find((item) => item.id === id); return member ? <span key={id} title={member.name}>{member.avatar}</span> : null; })}<small>{meal.participantIds.length} 人参与</small></div></div></div><div className="plan-nutrition"><span>预计每份</span><strong>{Math.round(((recipe && calculateRecipe(recipe).energyKcal) || 0) / (recipe?.yieldServings || 1))}<small> kcal</small></strong><span>蛋白质 {round(((recipe && calculateRecipe(recipe).proteinG) || 0) / (recipe?.yieldServings || 1), 1)}g</span></div><div className="plan-actions">{meal.status === "planned" ? <button className="primary-button" onClick={() => onConfirm(meal.id)}>确认实吃</button> : <span className="status confirmed"><Check size={14} />已确认</span>}<button className="icon-button" onClick={() => onCopy(meal)} title="复制到明天"><ClipboardList size={18} /></button><button className="icon-button"><MoreHorizontal size={18} /></button></div></article>;
      })}<button className="empty-meal" onClick={onAdd}><Plus size={20} /><span><strong>添加加餐</strong><small>水果、奶类或坚果</small></span></button></div>
    </div>
  );
}

function RecipesView({ recipes, search, setSearch, onFavorite, onAdd, onUse }: { recipes: Recipe[]; search: string; setSearch: (value: string) => void; onFavorite: (id: string) => void; onAdd: () => void; onUse: (recipe: Recipe) => void }) {
  const filtered = recipes.filter((recipe) => recipe.name.includes(search) || recipe.ingredients.some((ingredient) => ingredient.food.name.includes(search)));
  return <div className="page-stack"><div className="page-toolbar"><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索菜名或食材" /></label><button className="primary-button" onClick={onAdd}><Camera size={18} />拍照建菜谱</button></div><div className="recipe-grid">{filtered.map((recipe, index) => { const total = calculateRecipe(recipe); return <article className="recipe-card" key={recipe.id}><div className={`recipe-visual visual-${index % 3}`}><span>{recipe.tags[0]}</span><Utensils size={36} /><button onClick={() => onFavorite(recipe.id)} className={recipe.favorite ? "favorite" : ""} aria-label={recipe.favorite ? "取消收藏" : "收藏"}><Heart size={19} fill={recipe.favorite ? "currentColor" : "none"} /></button></div><div className="recipe-body"><div className="recipe-title"><div><span className="eyebrow">{recipe.category === "lunch" ? "午餐" : "晚餐"} · {recipe.yieldServings} 份</span><h3>{recipe.name}</h3></div><button className="icon-button"><MoreHorizontal size={18} /></button></div><p>{recipe.description}</p><div className="recipe-stats"><span><strong>{Math.round((total.energyKcal ?? 0) / recipe.yieldServings)}</strong> kcal/份</span><span><strong>{round((total.proteinG ?? 0) / recipe.yieldServings, 1)}</strong>g 蛋白质</span><span>{recipe.ingredients.length} 种食材</span></div><div className="recipe-footer"><small>更新于 {recipe.updatedAt}</small><button onClick={() => onUse(recipe)}>加入菜单 <Plus size={16} /></button></div></div></article>; })}</div>{filtered.length === 0 && <div className="empty-state"><Search size={28} /><h3>没有找到相关菜谱</h3><p>换个关键词，或者拍照创建新菜谱。</p></div>}</div>;
}

function ShoppingView({ shopping, setShopping, notify }: { shopping: ShoppingItem[]; setShopping: React.Dispatch<React.SetStateAction<ShoppingItem[]>>; notify: (message: string) => void }) {
  const [newItem, setNewItem] = useState("");
  const completed = shopping.filter((item) => item.checked).length;
  const add = () => { if (!newItem.trim()) return; setShopping((items) => [...items, { id: `s-${Date.now()}`, name: newItem.trim(), amount: 1, unit: "包", checked: false, source: "manual" }]); setNewItem(""); };
  return <div className="shopping-layout"><section className="shopping-hero"><div><span className="eyebrow">未来 3 天菜单</span><h2>采购清单</h2><p>系统已按菜谱份数合并同类食材。</p></div><div className="shopping-score"><strong>{completed}</strong><span>/ {shopping.length} 已购</span></div></section><section className="card shopping-list-card"><div className="card-heading"><div><span className="eyebrow">7月16日—7月18日</span><h3>待采购</h3></div><button className="text-button" onClick={() => notify("已按最新菜单重新汇总")}><RefreshCw size={15} />重新生成</button></div><div className="shopping-input"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} placeholder="手工添加，例如：酸奶" /><button onClick={add}><Plus size={18} />添加</button></div><div className="shopping-items">{shopping.map((item) => { const amount = normalizeShoppingAmount(item.amount, item.unit); return <label key={item.id} className={item.checked ? "checked" : ""}><input type="checkbox" checked={item.checked} onChange={() => setShopping((items) => items.map((current) => current.id === item.id ? { ...current, checked: !current.checked } : current))} /><span className="custom-check"><Check size={14} /></span><span className="item-name"><strong>{item.name}</strong><small>{item.source === "generated" ? "来自菜单" : "手工添加"}</small></span><span className="item-amount">{round(amount.amount, amount.unit === "kg" || amount.unit === "L" ? 1 : 0)} {amount.unit}</span><button onClick={(event) => { event.preventDefault(); setShopping((items) => items.filter((current) => current.id !== item.id)); }} aria-label={`删除${item.name}`}><Trash2 size={17} /></button></label>; })}</div></section><aside className="card shopping-tip"><div className="insight-icon"><Leaf size={20} /></div><h3>减少重复采购</h3><p>重新生成清单时，已勾选的同名食材会继续保留。库存与保质期将在后续版本加入。</p><div className="source-legend"><span><i className="generated" />菜单生成 {shopping.filter((item) => item.source === "generated").length}</span><span><i className="manual" />手工添加 {shopping.filter((item) => item.source === "manual").length}</span></div></aside></div>;
}

function FamilyView({ members, selectedMember, setSelectedMemberId, vitals, setMembers, onAddMember, onAddVital, notify }: { members: Member[]; selectedMember: Member; setSelectedMemberId: (id: string) => void; vitals: VitalRecord[]; setMembers: React.Dispatch<React.SetStateAction<Member[]>>; onAddMember: () => void; onAddVital: () => void; notify: (message: string) => void }) {
  const memberVitals = vitals.filter((vital) => vital.memberId === selectedMember.id);
  const weights = memberVitals.filter((vital) => vital.type === "weight");
  return <div className="family-layout"><section className="card family-list"><div className="card-heading"><div><span className="eyebrow">共享家庭</span><h3>林家小厨房</h3></div><button className="round-button" onClick={onAddMember}><Plus size={18} /></button></div><div className="family-members">{members.map((member) => <button key={member.id} className={member.id === selectedMember.id ? "active" : ""} onClick={() => setSelectedMemberId(member.id)}><span className="avatar large">{member.avatar}</span><span><strong>{member.name}</strong><small>{member.relation}</small></span><span className={`share-dot ${member.healthShared ? "on" : ""}`} title={member.healthShared ? "已共享健康数据" : "未共享"} /></button>)}</div><button className="invite-button" onClick={() => notify("邀请链接已复制，有效期 24 小时")}><Mail size={18} />邀请家庭成员</button><div className="privacy-callout"><ShieldCheck size={18} /><p><strong>健康数据仅家庭可见</strong>成人可随时撤回共享；代管成员由监护人管理。</p></div></section><div className="family-main"><section className="profile-hero"><div className="profile-person"><span className="avatar xl">{selectedMember.avatar}</span><div><span className="eyebrow">{selectedMember.managed ? "代管档案" : "本人档案"}</span><h2>{selectedMember.name}</h2><p>{selectedMember.relation} · {selectedMember.heightCm}cm · {selectedMember.weightKg}kg</p></div></div><button className="secondary-button"><Settings size={17} />编辑档案</button><div className="profile-facts"><div><span>活动量</span><strong>{selectedMember.activity === "high" ? "较高" : selectedMember.activity === "medium" ? "中等" : "较低"}</strong></div><div><span>体重目标</span><strong>维持体重</strong></div><div><span>过敏/忌口</span><strong>{selectedMember.allergies.join("、") || "无"}</strong></div><div><span>健康共享</span><button className={`switch ${selectedMember.healthShared ? "on" : ""}`} onClick={() => setMembers((items) => items.map((item) => item.id === selectedMember.id ? { ...item, healthShared: !item.healthShared } : item))}><span /></button></div></div></section><section className="card vitals-card"><div className="card-heading"><div><span className="eyebrow">最近 30 天</span><h3>体征趋势</h3></div><button className="primary-button small" onClick={onAddVital}><Plus size={16} />记录体征</button></div><div className="vital-summary"><div><Weight size={20} /><span><small>最新体重</small><strong>{weights.at(-1)?.value ?? selectedMember.weightKg}<em> kg</em></strong></span><i className="trend-down">↓ 0.8kg</i></div><div><Activity size={20} /><span><small>最近血压</small><strong>{memberVitals.findLast((item) => item.type === "bloodPressure")?.value ?? "—"}<em> / {memberVitals.findLast((item) => item.type === "bloodPressure")?.secondaryValue ?? "—"}</em></strong></span><i>仅作记录</i></div></div><div className="weight-chart" aria-label="体重趋势图">{weights.map((record, index) => <div key={record.id}><span style={{ height: `${50 + (record.value - 57) * 28}px` }} /><small>{index === weights.length - 1 ? "今天" : record.measuredAt.slice(5).replace("-", "/")}</small></div>)}</div></section><section className="card data-card"><div><ShieldCheck size={21} /><span><h3>你的数据权利</h3><p>可以导出个人数据、撤回健康共享或删除账号。删除不会保留体征和个人摄入明细。</p></span></div><div><button className="secondary-button" onClick={() => notify("已准备个人数据导出文件")}><Download size={17} />导出数据</button><button className="danger-button" onClick={() => notify("体验模式不会真正删除数据")}><Trash2 size={17} />删除账号</button></div></section></div></div>;
}

function LoginModal({ close, notify }: { close: () => void; notify: (message: string) => void }) {
  const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [step, setStep] = useState<"email" | "code">("email"); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const send = async () => { const parsed = emailSchema.safeParse(email); if (!parsed.success) return setError(parsed.error.issues[0].message); setLoading(true); setError(""); try { if (cloudbaseConfigured) await sendEmailOtp(parsed.data); else await new Promise((resolve) => setTimeout(resolve, 600)); setStep("code"); notify(cloudbaseConfigured ? "验证码已发送，请检查邮箱" : "体验模式：任意 6 位验证码均可"); } catch (reason) { setError(reason instanceof Error ? reason.message : "发送失败"); } finally { setLoading(false); } };
  const verify = async () => { const parsed = otpSchema.safeParse(code); if (!parsed.success) return setError(parsed.error.issues[0].message); setLoading(true); try { if (cloudbaseConfigured) await verifyEmailOtp(parsed.data); else await new Promise((resolve) => setTimeout(resolve, 500)); notify(cloudbaseConfigured ? "CloudBase 登录成功" : "已进入体验模式"); close(); } catch (reason) { setError(reason instanceof Error ? reason.message : "验证失败"); } finally { setLoading(false); } };
  return <AppModal title={cloudbaseConfigured ? "登录家庭空间" : "连接 CloudBase"} onClose={close}><div className="login-intro"><span className="login-symbol"><Leaf size={28} /></span><h3>{cloudbaseConfigured ? "用邮箱验证码安全登录" : "当前正在使用体验数据"}</h3><p>{cloudbaseConfigured ? "首次验证会自动创建账号，不需要设置密码。" : "配置环境 ID 与 Publishable Key 后，这里会启用真实邮箱验证码。"}</p></div>{step === "email" ? <label className="field"><span>邮箱地址</span><div className="input-with-icon"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoFocus /></div></label> : <label className="field"><span>6 位验证码</span><input className="otp-input" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" autoFocus /></label>}{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<button className="primary-button full" onClick={step === "email" ? send : verify} disabled={loading}>{loading ? "请稍候…" : step === "email" ? "发送验证码" : "验证并登录"}</button>{step === "code" && <button className="text-button center" onClick={() => setStep("email")}><ChevronLeft size={15} />修改邮箱</button>}<p className="privacy-fineprint"><ShieldCheck size={14} />登录即表示你已阅读隐私说明；健康数据需要另行授权。</p></AppModal>;
}

function RecipeModal({ close, addRecipe }: { close: () => void; addRecipe: (recipe: Recipe) => void }) {
  const [images, setImages] = useState<string[]>([]); const [analyzing, setAnalyzing] = useState(false); const [suggested, setSuggested] = useState(false); const [error, setError] = useState(""); const [form, setForm] = useState({ name: "", ingredientName: "", amountG: "", yieldServings: "3", energy: "", state: "raw" as "raw" | "cooked" | "packaged" }); const fileRef = useRef<HTMLInputElement>(null);
  const filesChanged = async (files: FileList | null) => {
    if (!files) return;
    setAnalyzing(true);
    setSuggested(false);
    setError("");
    try {
      const selected = await Promise.all(Array.from(files).slice(0, 3).map(compressPhoto));
      setImages(selected.map((file) => URL.createObjectURL(file)));
      if (cloudbaseConfigured) {
        const fileIds = await Promise.all(selected.map(uploadIngredientPhoto));
        const result = await analyzeIngredientPhoto(fileIds);
        const candidate = result.candidates[0];
        if (!candidate) throw new Error("没有识别到可靠食材，请手工录入");
        setForm((current) => ({
          ...current,
          name: candidate.name,
          ingredientName: candidate.name,
          amountG: candidate.visibleWeightG?.toString() ?? "",
          energy: result.labelNutritionPer100g?.energyKcal?.toString() ?? "",
          state: candidate.state,
        }));
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        setForm({ name: "清炒时蔬", ingredientName: "西兰花", amountG: "", yieldServings: "3", energy: "34", state: "raw" });
      }
      setSuggested(true);
    } catch (reason) {
      setError(`${reason instanceof Error ? reason.message : "图片识别失败"}；你仍可直接手工填写。`);
    } finally {
      setAnalyzing(false);
    }
  };
  const save = () => { const parsed = recipeSchema.safeParse(form); const energyParsed = z.coerce.number().nonnegative().safeParse(form.energy); if (!parsed.success) return setError(parsed.error.issues[0].message); if (!energyParsed.success) return setError("请输入每 100g 热量"); const now = new Date(); addRecipe({ id: `recipe-${now.getTime()}`, name: parsed.data.name, description: "来自食材照片，可继续补充做法和营养标签。", category: "dinner", favorite: false, yieldServings: parsed.data.yieldServings, finishedWeightG: parsed.data.amountG, tags: ["自定义"], updatedAt: "刚刚", image: images[0], ingredients: [{ id: `ingredient-${now.getTime()}`, amountG: parsed.data.amountG, edibleRatio: 1, food: { id: `food-${now.getTime()}`, name: parsed.data.ingredientName, aliases: [], state: form.state, source: "custom", sourceVersion: now.toISOString().slice(0, 10), nutrientsPer100g: customNutrition(energyParsed.data) } }] }); };
  return <AppModal title="拍照或手工创建菜谱" onClose={close} wide><div className="photo-uploader" onClick={() => fileRef.current?.click()}><input ref={fileRef} type="file" accept="image/jpeg,image/png" capture="environment" multiple hidden onChange={(event) => filesChanged(event.target.files)} />{images.length ? <div className="preview-grid">{images.map((image) => <img src={image} alt="待识别食材" key={image} width={240} height={174} />)}{images.length < 3 && <span><Plus size={22} />再加一张</span>}</div> : <><span className="camera-ring"><Camera size={28} /></span><strong>拍下食材或包装营养标签</strong><small>支持 JPEG / PNG，最多 3 张，自动压缩至最长边 1600px</small><button type="button"><Upload size={17} />选择照片</button></>}{analyzing && <div className="analysis-overlay"><Sparkles size={22} />AI 正在识别候选信息…</div>}</div>{suggested && <div className="ai-result"><Sparkles size={18} /><div><strong>候选：{form.ingredientName}</strong><p>{form.amountG ? `识别到可见重量 ${form.amountG}g` : "图片没有可靠重量，请确认称重信息。"}</p></div><span>待确认</span></div>}<div className="form-grid"><label className="field"><span>菜名</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：番茄炒蛋" /></label><label className="field"><span>主要食材</span><input value={form.ingredientName} onChange={(event) => setForm({ ...form, ingredientName: event.target.value })} placeholder="例如：番茄" /></label><label className="field"><span>食材重量（g）</span><input type="number" value={form.amountG} onChange={(event) => setForm({ ...form, amountG: event.target.value })} placeholder="必须由你确认" /></label><label className="field"><span>出品份数</span><input type="number" value={form.yieldServings} onChange={(event) => setForm({ ...form, yieldServings: event.target.value })} /></label><label className="field"><span>每 100g 热量（kcal）</span><input type="number" value={form.energy} onChange={(event) => setForm({ ...form, energy: event.target.value })} placeholder="来自标签或食材库" /></label><label className="field"><span>食材状态</span><select value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value as typeof form.state })}><option value="raw">生鲜/原始</option><option value="cooked">熟制</option><option value="packaged">包装食品</option></select></label></div>{error && <p className="form-error"><CircleAlert size={15} />{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={close}>取消</button><button className="primary-button" onClick={save}><Check size={17} />确认并保存</button></div></AppModal>;
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
