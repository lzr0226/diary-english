"use client";
import Image from "next/image";
import { cloudEnabled } from "@/lib/cloud/config";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { readPhoto } from "@/lib/photos";
import { useApp, Header } from "./App";
import { Empty, Modal } from "./ui";
export function PhotoStrip({
  ids,
  remove,
}: {
  ids: string[];
  remove?: (id: string) => void;
}) {
  const { user } = useApp();
  const [sources, setSources] = useState<Record<string, string>>({});
  const [view, setView] = useState("");
  const [error, setError] = useState("");
  const key = ids.join(",");
  useEffect(() => {
    let alive = true;
    setError("");
    Promise.all(
      key
        .split(",")
        .filter(Boolean)
        .map(async (id) => [id, await readPhoto(user, id)] as const),
    )
      .then((items) => {
        if (alive)
          setSources(
            Object.fromEntries(
              items.filter((x): x is readonly [string, string] => !!x[1]),
            ),
          );
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [key, user]);
  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="photo-grid">
        {ids.map((id, i) => (
          <div key={id}>
            {sources[id] ? (
              <button
                className="photo-button"
                onClick={() => setView(id)}
                aria-label={`查看日记图片 ${i + 1}`}
              >
                <Image
                  unoptimized
                  width={320}
                  height={240}
                  src={sources[id]}
                  alt={`日记图片 ${i + 1}`}
                />
              </button>
            ) : (
              <div className="photo-missing">图片加载中或已丢失</div>
            )}
            {remove && (
              <button
                className="remove-photo"
                aria-label={`移除图片 ${i + 1}`}
                onClick={() => remove(id)}
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {view && sources[view] && (
        <Modal title="日记图片" close={() => setView("")}>
          <Image
            unoptimized
            className="photo-full"
            width={1600}
            height={1200}
            src={sources[view]}
            alt="日记图片大图"
          />
          <a
            className="button primary wide"
            download="日记照片.jpg"
            href={sources[view]}
          >
            保存图片
          </a>
        </Modal>
      )}
    </>
  );
}
export function Album() {
  const { data } = useApp();
  const diaries = data.diaries
    .filter((d) => !d.deletedAt && d.images?.length)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Header title="日记相册" />
      <Link href="/me" className="button subtle">
        <ArrowLeft size={16} />
        返回我的
      </Link>
      <p className="notice">
        {cloudEnabled
          ? "图片保存在你的私有云端相册，按日记日期排列。"
          : "图片保存在当前浏览器，按日记日期排列。点击照片可放大和保存。"}
      </p>
      {diaries.length ? (
        diaries.map((d) => (
          <section className="card" key={d.id}>
            <div className="card-heading">
              <Link href={`/diaries/${d.id}`}>{d.title || "无题日记"}</Link>
              <span className="tiny muted">
                {new Date(d.date).toLocaleDateString()}
              </span>
            </div>
            <PhotoStrip ids={d.images || []} />
          </section>
        ))
      ) : (
        <Empty
          title="还没有日记照片"
          description="在新建或编辑日记时添加图片，保存后就会出现在这里。"
        >
          <Link href="/diaries/new" className="button primary">
            记录第一张照片
          </Link>
        </Empty>
      )}
    </>
  );
}
