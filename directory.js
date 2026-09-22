(function () {
  "use strict";

  const body = document.body;
  const clean = (value) => value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const withoutType = (value) => value.replace(/[市县域府郡]$/, "");

  function parseSource(text) {
    const states = [];
    let state;
    let subdivision;
    let subdivisionCount = 0;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = clean(rawLine);
      if (!line) continue;
      const match = line.match(/^(\S+)\s+(.+)$/);
      if (!match) {
        if (subdivision && !/^(缺州府：|共\d)/.test(line)) subdivision.items.push(line);
        continue;
      }
      const code = match[1];
      const value = match[2].trim();
      if (/^[0-9A-F]{2}$/.test(code)) {
        state = { code, name: value, subdivisions: [] };
        states.push(state);
        subdivision = null;
        subdivisionCount = 0;
        continue;
      }
      if (/^[0-9A-Fx]{3}$/.test(code) && value.includes("/")) {
        const fields = value.split("/").map((field) => field.trim());
        if (fields.length < 3 || !state) continue;
        subdivisionCount += 1;
        subdivision = {
          code,
          name: fields[0],
          english: fields[1],
          abbreviation: fields[2],
          local: fields.slice(3).filter(Boolean).join(" / "),
          type: subdivisionCount === 1 ? "府" : "郡",
          items: []
        };
        state.subdivisions.push(subdivision);
        continue;
      }
      if (subdivision && !/^(缺州府：|共\d)/.test(line)) subdivision.items.push(line);
    }
    return states;
  }

  function parseItem(line, subdivision) {
    const fields = line.split(/\s+/);
    const name = fields.shift() || "";
    const aliases = [];
    for (const field of fields) {
      if (field === "=") {
        aliases.push({ mode: "parent", suffix: "" });
      } else if (field.startsWith("=")) {
        aliases.push({ mode: "parent", suffix: field.slice(1) });
      } else if (field === "-") {
        aliases.push({ mode: "item", suffix: "" });
      } else if (field.startsWith("-")) {
        aliases.push({ mode: "item", suffix: field.slice(1) });
      } else {
        aliases.push({ mode: "local", value: field });
      }
    }
    const parentName = withoutType(subdivision.name);
    const itemName = withoutType(name);
    return {
      name,
      aliases: aliases.map((alias) => {
        if (alias.mode === "parent") return { mode: alias.mode, value: parentName + alias.suffix };
        if (alias.mode === "item") return { mode: alias.mode, value: itemName + alias.suffix };
        return { mode: alias.mode, value: alias.value };
      })
    };
  }

  function subdivisionLabel(data) {
    const language = data.english || data.local;
    const local = data.english && data.local ? ` / ${data.local}` : "";
    const roman = language ? ` (${language}${local})` : "";
    const abbreviation = data.abbreviation ? ` - ${data.abbreviation}` : "";
    return `${data.code} ${data.name}${data.type}${roman}${abbreviation}`;
  }

  function createGroup(data, level) {
    const section = document.createElement("section");
    section.className = `directory-group level-${level}`;
    const header = document.createElement("div");
    header.className = "group-header";
    header.dataset.name = data.name + (data.type || "");
    const toggle = document.createElement("button");
    toggle.className = "toggle";
    toggle.type = "button";
    toggle.innerHTML = '<span class="chevron" aria-hidden="true">›</span><span class="name"></span>';
    toggle.querySelector(".name").textContent = level === "subdivision" ? subdivisionLabel(data) : `${data.code} ${data.name}`;
    toggle.setAttribute("aria-expanded", "false");
    header.append(toggle);
    if (level === "subdivision") {
      const mapButton = document.createElement("button");
      mapButton.className = "map-trigger";
      mapButton.type = "button";
      mapButton.textContent = "地图";
      mapButton.title = "查看地图";
      mapButton.dataset.code = data.code;
      mapButton.dataset.name = data.name + data.type;
      header.append(mapButton);
    }
    const content = document.createElement("div");
    content.className = "group-content";
    section.append(header, content);
    toggle.addEventListener("click", () => {
      const open = section.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    return { section, content };
  }

  function createIntroduction() {
    const intro = document.createElement("section");
    intro.className = "intro";
    intro.innerHTML = `
      <p>三字母简写规则（若相同或不可取依次顺延）：</p>
      <ol>
        <li>取第一字罗马字的前两个字符，与第二字罗马字的第一个字符</li>
        <li>取第一字罗马字的第一个字符，与第二字罗马字的前两个字符</li>
        <li>分别取三个字罗马字的第一个字符</li>
        <li>取全拼罗马字的前三个字符</li>
        <li>取第1、2、4字符</li>
        <li>取第1、2、5字符</li>
      </ol>
      <p>罗马字即使用标准汉语拼音（原依据汾阳话的罗马字转换规范见旧版文档）。</p>
      <p>下辖行政区编号顺序（2026.3更新）：首项必为州府、府治或郡治，然后从最北点开始顺时针环绕除去府、治的剩余部分外围，环绕一圈后再从剩余部分的最北点顺时针环绕外围，以此类推。部分州、府、郡目前不符合该条例，需修改。</p>
      <p>州 → 府/郡 → 市/县/域 → 区/镇/乡 → 坊/村</p>
      <p><u>州</u>为一级行政区；<u>府</u>为州府所在地；<u>郡</u>为一般二级行政区。</p>
      <p><u>市</u>为各郡中心城区和较发达的三级行政区；<u>县</u>为一般三级行政区；<u>域</u>为欠发达或地广人稀的三级行政区。</p>
      <p><u>区</u>为市所辖发达的四级行政区；<u>镇</u>比<u>乡</u>发达，是一般的四级行政区。<u>坊</u>为区或镇下基层行政区，<u>村</u>为镇或乡下基层行政区。</p>
      <p><strong>TODO：</strong>完成畿、原、山、平诸州；更新三字母简写；绘制完成所有府；区改市已完成。</p>
      <p>数据源：<a href="xzqh.txt">xzqh.txt</a>。州、府、郡默认折叠；悬停行政区可查看介绍，点击府或郡名称可查看地图。</p>`;
    return intro;
  }

  function createSummary(states) {
    const summary = document.createElement("p");
    summary.className = "directory-summary";
    const populated = states.flatMap((state) => state.subdivisions).filter((subdivision) => subdivision.items.length > 0);
    const counts = { 市: 0, 县: 0, 域: 0 };
    populated.forEach((subdivision) => subdivision.items.forEach((line) => {
      const name = line.split(/\s+/, 1)[0];
      Object.keys(counts).forEach((type) => { if (name.endsWith(type)) counts[type] += 1; });
    }));
    const fu = populated.filter((subdivision) => subdivision.type === "府").length;
    const jun = populated.filter((subdivision) => subdivision.type === "郡").length;
    summary.textContent = `共${states.length}州、${fu}府、${jun}郡、${counts.市}市、${counts.县}县、${counts.域}域`;
    return summary;
  }

  function createMissingPrefectures(states) {
    const missing = states.flatMap((state) => state.subdivisions
      .filter((subdivision) => subdivision.type === "府" && subdivision.items.length === 0)
      .map((subdivision) => `${state.name}${subdivision.name}府`));
    const section = document.createElement("section");
    section.className = "missing-prefectures";
    const title = document.createElement("h2");
    title.textContent = "缺州府";
    section.append(title);
    if (missing.length === 0) {
      const message = document.createElement("p");
      message.textContent = "无";
      section.append(message);
      return section;
    }
    const list = document.createElement("ul");
    missing.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      list.append(item);
    });
    section.append(list);
    return section;
  }

  function render(states) {
    body.append(createIntroduction());
    const title = document.createElement("h1");
    title.className = "directory-title";
    title.textContent = "氢";
    body.append(title);
    const directory = document.createElement("main");
    directory.id = "directory";
    directory.className = "directory";
    for (const state of states) {
      const stateGroup = createGroup(state, "state");
      directory.append(stateGroup.section);
      for (const subdivision of state.subdivisions) {
        const subdivisionGroup = createGroup(subdivision, "subdivision");
        stateGroup.content.append(subdivisionGroup.section);
        for (const rawItem of subdivision.items) {
          const item = parseItem(rawItem, subdivision);
          const element = document.createElement("div");
          element.className = "directory-item";
          element.dataset.name = item.name;
          element.append(document.createTextNode(item.name));
          if (item.aliases.length) {
            element.append(document.createTextNode("："));
            item.aliases.forEach((alias, index) => {
              if (index) element.append(document.createTextNode("｜"));
              const station = document.createElement("span");
              station.className = "site-tag";
              station.dataset.name = alias.value;
              station.textContent = alias.value;
              element.append(station);
            });
          }
          subdivisionGroup.content.append(element);
        }
      }
    }
    body.append(directory);
    body.append(createSummary(states));
    body.append(createMissingPrefectures(states));
    setupInteractions(directory);
  }

  function setupInteractions(directory) {
    const controls = document.createElement("div");
    controls.className = "directory-toolbar";
    controls.innerHTML = '<input type="search" placeholder="搜索州、府、郡或下辖区域" aria-label="搜索行政区"><button type="button" data-action="open">全部展开</button><button type="button" data-action="close">全部收起</button>';
    body.insertBefore(controls, directory);
    const tooltip = document.createElement("aside");
    tooltip.className = "tooltip";
    tooltip.setAttribute("role", "status");
    body.append(tooltip);
    const mapPanel = document.createElement("section");
    mapPanel.className = "map-panel";
    mapPanel.innerHTML = '<header><span></span><button class="map-close" type="button">关闭</button></header><img alt="行政区地图">';
    body.append(mapPanel);
    const mapImage = mapPanel.querySelector("img");
    let mapSources = [];
    let mapSourceIndex = 0;
    mapImage.addEventListener("error", () => {
      mapSourceIndex += 1;
      if (mapSourceIndex < mapSources.length) mapImage.src = mapSources[mapSourceIndex];
    });
    const descriptions = new Map();
    let activeDescriptionTarget = null;
    const routeColors = ["#d97706", "#0f766e", "#2563eb", "#be185d", "#7c3aed", "#15803d", "#c2410c", "#0369a1"];
    function routeColor(route) {
      let hash = 0;
      for (const character of route) hash = (hash * 31 + character.codePointAt(0)) | 0;
      return routeColors[Math.abs(hash) % routeColors.length];
    }
    function renderDescription(description, target) {
      if (target.classList.contains("site-tag") && description.routes.length) {
        let routeList = document.querySelector(".route-orbit");
        if (!routeList) {
          routeList = document.createElement("div");
          routeList.className = "route-orbit";
          body.append(routeList);
        }
        routeList.replaceChildren();
        description.routes.forEach((route, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "route-tag";
          button.dataset.route = route;
          button.textContent = route;
          button.style.setProperty("--route-color", routeColor(route));
          button.style.setProperty("--route-angle", `${(360 / description.routes.length) * index}deg`);
          button.style.setProperty("--route-radius", `${Math.max(42, Math.min(76, 34 + description.routes.length * 6))}px`);
          routeList.append(button);
        });
        positionRouteOrbit(routeList, target);
        routeList.classList.add("is-visible");
      }
      tooltip.replaceChildren();
      const text = document.createElement("div");
      text.className = "description-body";
      text.textContent = description.body;
      tooltip.append(text);
    }
    const moveTooltip = (event) => {
      const left = Math.min(event.clientX + 14, window.innerWidth - tooltip.offsetWidth - 12);
      const top = Math.min(event.clientY + 14, window.innerHeight - tooltip.offsetHeight - 12);
      tooltip.style.left = Math.max(12, left) + "px";
      tooltip.style.top = Math.max(12, top) + "px";
    };
    function positionRouteOrbit(routeList, target) {
      const bounds = target.getBoundingClientRect();
      routeList.style.left = `${bounds.left + bounds.width / 2}px`;
      routeList.style.top = `${bounds.top + bounds.height / 2}px`;
    }
    async function showDescription(target, event) {
      const name = target.dataset.name;
      if (!name) return;
      const isSite = target.classList.contains("site-tag");
      const descriptionKey = isSite ? `${name}站` : name;
      if (!descriptions.has(descriptionKey)) {
        const candidates = isSite ? [`${name}站`] : [name, withoutType(name)];
        let description = "";
        for (const candidate of candidates) {
          try {
            const response = await fetch(`desc/${encodeURIComponent(candidate)}.txt`);
            if (response.ok) { description = (await response.text()).trim(); if (description) break; }
          } catch (_) { /* try the next candidate */ }
        }
        const lines = description.split(/\r?\n/);
        descriptions.set(descriptionKey, {
          routes: isSite && lines[0] ? lines[0].trim().split(/\s+/).filter(Boolean) : [],
          body: isSite ? (lines.slice(1).join("\n") || "（尚无介绍）") : (description || "（尚无介绍）")
        });
      }
      if (activeDescriptionTarget === target) {
        renderDescription(descriptions.get(descriptionKey), target);
        tooltip.classList.add("is-visible");
        moveTooltip(event);
      }
    }
    directory.addEventListener("pointerover", (event) => {
      const target = event.target.closest(".site-tag, .group-header, .directory-item");
      if (target) {
        if (activeDescriptionTarget?.classList.contains("site-tag") && target.classList.contains("directory-item") && activeDescriptionTarget.parentElement === target) return;
        activeDescriptionTarget = target;
        showDescription(target, event);
      }
    });
    directory.addEventListener("pointermove", (event) => { if (tooltip.classList.contains("is-visible")) moveTooltip(event); });
    directory.addEventListener("pointerout", (event) => {
      const related = event.relatedTarget;
      const activeItem = activeDescriptionTarget?.closest?.(".directory-item");
      const relatedItem = related?.closest?.(".directory-item");
      if (activeItem && relatedItem === activeItem) return;
      const staysInTarget = activeDescriptionTarget && related && (related === activeDescriptionTarget || activeDescriptionTarget.contains(related));
      const staysInOrbit = related?.closest?.(".route-orbit");
      if (!staysInTarget && !staysInOrbit) {
        tooltip.classList.remove("is-visible");
        document.querySelector(".route-orbit")?.classList.remove("is-visible");
        activeDescriptionTarget = null;
      }
    });
    directory.addEventListener("pointerleave", (event) => {
      if (event.relatedTarget?.closest?.(".route-orbit")) return;
      tooltip.classList.remove("is-visible");
      document.querySelector(".route-orbit")?.classList.remove("is-visible");
      activeDescriptionTarget = null;
    });
    body.addEventListener("pointerleave", (event) => {
      if (!event.relatedTarget?.closest?.(".route-orbit, .site-tag")) {
        document.querySelector(".route-orbit")?.classList.remove("is-visible");
      }
    });
    body.addEventListener("click", (event) => {
      const route = event.target.closest(".route-tag");
      if (!route) return;
      directory.dispatchEvent(new CustomEvent("route-select", { detail: { route: route.dataset.route } }));
      route.classList.toggle("is-selected");
    });
    directory.addEventListener("click", (event) => {
      const button = event.target.closest(".map-trigger");
      if (!button) return;
      mapPanel.querySelector("header span").textContent = button.dataset.name + "地图";
      mapImage.alt = button.dataset.name + "地图";
      mapSources = [`map/${encodeURIComponent(button.dataset.code)}.png`, `map/${encodeURIComponent(button.dataset.name)}.png`, "map/default.png"];
      mapSourceIndex = 0;
      mapImage.src = mapSources[0];
      mapPanel.classList.add("is-visible");
    });
    mapPanel.querySelector(".map-close").addEventListener("click", () => mapPanel.classList.remove("is-visible"));
    controls.addEventListener("click", (event) => {
      if (!event.target.dataset.action) return;
      const open = event.target.dataset.action === "open";
      directory.querySelectorAll(".directory-group").forEach((section) => {
        section.classList.toggle("is-open", open);
        section.querySelector(".toggle").setAttribute("aria-expanded", String(open));
      });
    });
    controls.querySelector("input").addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      directory.querySelectorAll(".directory-group").forEach((section) => section.classList.toggle("is-filtered-out", Boolean(query) && !section.textContent.toLowerCase().includes(query)));
      directory.querySelectorAll(".directory-item").forEach((item) => item.classList.toggle("is-filtered-out", Boolean(query) && !item.textContent.toLowerCase().includes(query)));
    });
  }

  fetch("xzqh.txt").then((response) => {
    if (!response.ok) throw new Error("无法读取 xzqh.txt");
    return response.text();
  }).then((text) => render(parseSource(text))).catch((error) => {
    const message = document.createElement("p");
    message.className = "intro error";
    message.textContent = error.message;
    body.append(message);
  });
})();
