import React, {
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import clsx from "clsx";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

import Translate, { translate } from "@docusaurus/Translate";
import { useHistory, useLocation } from "@docusaurus/router";
import Link from "@docusaurus/Link";
import Loadable from "@docusaurus/react-loadable";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import {
  EditOutlined,
  HeartOutlined,
  SearchOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import { debounce } from "lodash";
import FavoriteIcon from "@site/src/components/svgIcons/FavoriteIcon";
import styles from "@site/src/pages/styles.module.css";
import { Tags, TagList, type User, type TagType } from "@site/src/data/tags";
import { sortedUsers } from "@site/src/data/users.zh";

import ShowcaseTagSelect, {
  readSearchTags,
} from "@site/src/pages/_components/ShowcaseTagSelect";
import ShowcaseFilterToggle, {
  type Operator,
  readOperator,
} from "@site/src/pages/_components/ShowcaseFilterToggle";
import ShowcaseTooltip from "@site/src/pages/_components/ShowcaseTooltip";
import ShowcaseCard from "@site/src/pages/_components/ShowcaseCard";
import UserStatus from "@site/src/pages/_components/user/UserStatus";
import UserPrompts from "@site/src/pages/_components/user/UserPrompts";
import UserFavorite from "@site/src/pages/_components/user/UserFavorite";
import {
  AuthContext,
  AuthProvider,
} from "@site/src/pages/_components/AuthContext";

import Typed from "typed.js";

import { fetchAllCopyCounts } from "@site/src/api";
const ShareButtons = Loadable({
  loader: () => import("@site/src/pages/_components/ShareButtons"),
  loading: () => null,
});

const TITLE = translate({
  id: "homepage.title",
  message: "AiShort(ChatGPT Shortcut)-简单易用的 AI 快捷指令表，让生产力倍增！",
});
const DESCRIPTION = translate({
  id: "homepage.description",
  message:
    "AI Short 是一款用于管理和分享 AI 提示词的工具，帮助用户更有效地定制、保存和共享自己的提示词，以提高生产力。该平台还包括一个提示词分享社区，让用户轻松找到适用于不同场景的指令。",
});
const SLOGAN = translate({
  id: "homepage.slogan",
  message: "让生产力加倍的 AI 快捷指令",
});

type UserState = {
  scrollTopPosition: number;
  focusedElementId: string | undefined;
};

export function prepareUserState(): UserState | undefined {
  if (ExecutionEnvironment.canUseDOM) {
    return {
      scrollTopPosition: window.scrollY,
      focusedElementId: document.activeElement?.id,
    };
  }

  return undefined;
}

const SearchNameQueryKey = "name";

function readSearchName(search: string) {
  return new URLSearchParams(search).get(SearchNameQueryKey);
}

function filterUsers(
  users: User[],
  selectedTags: TagType[],
  operator: Operator,
  searchName: string | null
) {
  const { i18n } = useDocusaurusContext();
  const currentLanguage = i18n.currentLocale.split("-")[0];
  if (searchName) {
    const lowercaseSearchName = searchName.toLowerCase();
    // 搜索范围
    users = users.filter((user) =>
      (
        user[currentLanguage].title +
        user[currentLanguage].prompt +
        (user[currentLanguage].description ?? "") +
        user[currentLanguage].remark
      )
        .toLowerCase()
        .includes(lowercaseSearchName)
    );
  }
  if (selectedTags.length === 0) {
    return users.sort((a, b) => b.weight - a.weight);
  }
  return users.filter((user) => {
    if (user.tags.length === 0) {
      return false;
    }
    if (operator === "AND") {
      return selectedTags.every((tag) => user.tags.includes(tag));
    }
    return selectedTags.some((tag) => user.tags.includes(tag));
  });
}

function useFilteredUsers() {
  const location = useLocation<UserState>();
  const [operator, setOperator] = useState<Operator>("OR");
  // On SSR / first mount (hydration) no tag is selected
  const [selectedTags, setSelectedTags] = useState<TagType[]>([]);
  const [searchName, setSearchName] = useState<string | null>(null);
  // Sync tags from QS to state (delayed on purpose to avoid SSR/Client
  // hydration mismatch)
  useEffect(() => {
    setSelectedTags(readSearchTags(location.search));
    setOperator(readOperator(location.search));
    setSearchName(readSearchName(location.search));
  }, [location]);

  return useMemo(
    () => filterUsers(sortedUsers, selectedTags, operator, searchName),
    [selectedTags, operator, searchName]
  );
}

function ShowcaseHeader() {
  const slogan = React.useRef(null);

  React.useEffect(() => {
    const typed = new Typed(slogan.current, {
      strings: [
        "让生产力加倍的 Prompt 快捷指令！",
        "一键复制，即可用于IMYAI-GPT Cluade 文心 千问 讯飞 等对话！",
      ],
      typeSpeed: 60,
      backSpeed: 60,
      backDelay: 500,
      loop: true,
    });
    return () => {
      // Destroy Typed instance during cleanup to stop animation
      typed.destroy();
    };
  }, []);
  return (
    <section className={"text--center"}>
      <div className={styles.titleArea}>
        <Heading as="h1" className={styles.blueTitle}>
          AI 对话提示词库
        </Heading>
        <span ref={slogan}>&nbsp;</span>
      </div>
      <UserStatus hideLinks={{ userCenter: false, myFavorite: false }} />
    </section>
  );
}

function ShowcaseFilters({
  onToggleDescription,
  showUserFavs,
  setShowUserFavs,
}) {
  const { userAuth } = useContext(AuthContext);
  const { i18n } = useDocusaurusContext();
  const currentLanguage = i18n.currentLocale.split("-")[0];

  // 登陆后显示用户提示词和收藏夹，两者不可同时显示
  const [showUserPrompts, setShowUserPrompts] = useState(false);
  const handleUserPrompts = () => {
    setShowUserFavs(false);
    setShowUserPrompts(!showUserPrompts);
  };
  const handleUserFavs = () => {
    setShowUserPrompts(false);
    setShowUserFavs(!showUserFavs);
  };

  let modifiedTagList = TagList.filter((tag) => tag !== "contribute");
  if (userAuth) {
    modifiedTagList = modifiedTagList.filter((tag) => tag !== "favorite");
  }

  // 提前调用 Translate 组件以确保 Hooks 的调用顺序一致
  const togglePromptLanguage = (
    <Translate id="toggle_prompt_language">切换 Prompt 语言</Translate>
  );

  const handleMoreClick = () => {
    window.location.href = "https://tuo.icodeq.com/prompt";
  };
  const history = useHistory();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    setValue(readSearchName(location.search));
    if (searchRef.current) {
      searchRef.current.focus();
    }
  }, [location]);

  const updateSearch = useCallback(
    debounce((searchValue: string) => {
      const newSearch = new URLSearchParams(location.search);
      newSearch.delete(SearchNameQueryKey);
      if (searchValue) {
        newSearch.set(SearchNameQueryKey, searchValue);
      }
      history.push({
        ...location,
        search: newSearch.toString(),
        state: prepareUserState(),
      });
    }, 1000), // search latency 搜索延时
    [location, history]
  );

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    setValue(e.currentTarget.value);
    updateSearch(e.currentTarget.value);
  };

  return (
    <section className="container">
      <div className={styles.filterCheckbox}>
        {currentLanguage !== "en" && (
          <>
          <button
            onClick={onToggleDescription}
            className={styles.onToggleButton}
            title={translate({
              id: "toggle_prompt_language_description",
              message:
                "更改提示词的显示语言，可以在英语和当前页面语言之间进行切换。",
            })}
          >
            {togglePromptLanguage}
          </button>
          <div className={styles.searchContainer} style={{ position: 'relative' }}>
          <input
            ref={searchRef}
            id="searchbar"
            placeholder={translate({
              message: "Search for prompts...",
              id: "showcase.searchBar.placeholder",
            })}
            value={value ?? undefined}
            onInput={handleInput}
            style={{ paddingLeft: '30px' }} // 为图标留出空间
          />
          <SearchOutlined style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
        </div>

          </>
        )}
      </div>
      
      
      <ul className={clsx("clean-list", styles.checkboxList)}>
        {modifiedTagList.map((tag, i) => {
          const { label, description, color } = Tags[tag];
          const id = `showcase_checkbox_id_${tag}`;

          const handleTagClick = () => {
            if (!userAuth) {
              return;
            }
            setShowUserPrompts(false);
            setShowUserFavs(false);
          };

          return (
            <>
              {tag === "favorite" ? (
                <></>
              ) : (
                <li
                  key={i}
                  className={styles.checkboxListItem}
                  onClick={handleTagClick}
                >
                  <ShowcaseTooltip
                    id={id}
                    text={description}
                    anchorEl="#__docusaurus"
                  >
                    <ShowcaseTagSelect tag={tag} id={id} label={label} />
                  </ShowcaseTooltip>
                </li>
              )}
            </>
          );
        })}
        <li className={styles.checkboxListItem} onClick={handleMoreClick}>
          <ShowcaseTooltip text="探索更多" anchorEl="#__docusaurus">
            <ShowcaseTagSelect tag="探索更多" label="探索更多" />
          </ShowcaseTooltip>
        </li>
      </ul>
      {showUserPrompts && <UserPrompts />}
      {showUserFavs && <UserFavorite />}
    </section>
  );
}


function ShowcaseCards({ isDescription, showUserFavs }) {
  const [copyCounts, setCopyCounts] = useState({});

  const { userAuth } = useContext(AuthContext);
  const [userLoves, setUserLoves] = useState(
    () => userAuth?.data?.favorites?.loves || []
  );
  const [showAllOtherUsers, setShowAllOtherUsers] = useState(false);

  // 当 userAuth 改变时，更新 userLoves 的值
  useEffect(() => {
    setUserLoves(userAuth?.data?.favorites?.loves || []);
  }, [userAuth]);

  const [favoriteUsers, otherUsers] = useMemo(() => {
    return sortedUsers.reduce(
      ([favorites, others], user) => {
        let updatedUser = { ...user }; // 创建新对象，避免直接修改
        if (userAuth && updatedUser.tags.includes("favorite")) {
          updatedUser.tags = updatedUser.tags.filter(
            (tag) => tag !== "favorite"
          );
        }
        if (
          userLoves &&
          userLoves.includes(updatedUser.id) &&
          !updatedUser.tags.includes("favorite")
        ) {
          updatedUser.tags = [...updatedUser.tags, "favorite"];
        }
        if (updatedUser.tags.includes("favorite")) {
          favorites.push(updatedUser);
        } else {
          others.push(updatedUser);
        }
        return [favorites, others];
      },
      [[], []]
    );
  }, [sortedUsers, userAuth, userLoves]);

  const displayedOtherUsers = showAllOtherUsers
    ? otherUsers
    : otherUsers.slice(0, 24);

  favoriteUsers.sort((a, b) => b.weight - a.weight);
  otherUsers.sort((a, b) => b.weight - a.weight);

  useEffect(() => {
    const fetchData = async () => {
      const counts = await fetchAllCopyCounts();
      setCopyCounts(counts);
    };

    fetchData();
  }, []);

  const handleCardCopy = useCallback((cardId) => {
    setCopyCounts((prevCopyCounts) => ({
      ...prevCopyCounts,
      [cardId]: (prevCopyCounts[cardId] || 0) + 1,
    }));
  }, []);

  const filteredUsers = useFilteredUsers();

  if (filteredUsers.length === 0) {
    return (
      <section className="margin-top--lg margin-bottom--xl">
        <div className="container padding-vert--md text--center">
          <Heading as="h2">
            <Translate id="showcase.usersList.noResult">
              😒 找不到结果，请缩短搜索词
            </Translate>
          </Heading>
        </div>
      </section>
    );
  }
  if (showUserFavs) {
    // 如果 showUserFavs 为 true，则不渲染 Favorites 区块
    return (
      <section className="margin-top--lg margin-bottom--xl">
        {filteredUsers.length === sortedUsers.length ? (
          <>
            <div className="container margin-top--lg">
              <div
                className={clsx(
                  "margin-bottom--md",
                  styles.showcaseFavoriteHeader
                )}
              >
                <Heading as="h2">
                  <Translate id="showcase.usersList.allUsers">
                    All prompts
                  </Translate>
                </Heading>
              </div>
              <ul className={clsx("clean-list", styles.showcaseList)}>
                {displayedOtherUsers.map((user) => (
                  <ShowcaseCard
                    key={user.id}
                    user={user}
                    isDescription={isDescription}
                    copyCount={copyCounts[user.id] || 0}
                    onCopy={handleCardCopy}
                    onLove={setUserLoves}
                  />
                ))}
              </ul>
              {!showAllOtherUsers && otherUsers.length > 50 && (
                <Link
                  className="button button--secondary"
                  style={{ width: "100%" }}
                  onClick={() => setShowAllOtherUsers(true)}
                >
                  {<ArrowDownOutlined />}
                  <Translate>加载更多</Translate>
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="container">
            <div
              className={clsx(
                "margin-bottom--md",
                styles.showcaseFavoriteHeader
              )}
            >
            </div>
            <ul className={clsx("clean-list", styles.showcaseList)}>
              {filteredUsers.map((user) => (
                <ShowcaseCard
                  key={user.id}
                  user={user}
                  isDescription={isDescription}
                  copyCount={copyCounts[user.id] || 0}
                  onCopy={handleCardCopy}
                  onLove={setUserLoves}
                />
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  // 正常渲染 Favorites 区块
  return (
    <div className="container">
      <div className={clsx("margin-bottom--md", styles.showcaseFavoriteHeader)}>
      </div>
      <ul className={clsx("clean-list", styles.showcaseList)}>
        {filteredUsers.map((user) => (
          <ShowcaseCard
            key={user.id}
            user={user}
            isDescription={isDescription}
            copyCount={copyCounts[user.id] || 0}
            onCopy={handleCardCopy}
            onLove={setUserLoves}
          />
        ))}
      </ul>
    </div>
  );
}

export default function Showcase(): JSX.Element {
  const [Shareurl, setShareUrl] = useState("");
  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);
  const [isDescription, setIsDescription] = useState(true);
  const [showUserFavs, setShowUserFavs] = useState(false);
  const toggleDescription = useCallback(() => {
    setIsDescription((prevIsDescription) => !prevIsDescription);
  }, []);
  return (
    <Layout title={TITLE} description={DESCRIPTION}>
      <main className="margin-vert--md">
        <AuthProvider>
          <ShowcaseHeader />
          <ShowcaseFilters
            onToggleDescription={toggleDescription}
            showUserFavs={showUserFavs}
            setShowUserFavs={setShowUserFavs}
          />
          <ShowcaseCards
            isDescription={isDescription}
            showUserFavs={showUserFavs}
          />
        </AuthProvider>
        <ShareButtons shareUrl={Shareurl} title={TITLE} popOver={false} />
      </main>
    </Layout>
  );
}
