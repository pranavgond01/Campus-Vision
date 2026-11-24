"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Search,
  Trash2,
  UserRound,
  GraduationCap,
  RefreshCw,
  Eye,
} from "lucide-react";

import {
  deletePerson,
  getPeople,
  Person,
} from "@/lib/api";
import PersonDetailsModal from "@/components/PersonDetailsModal";

export default function PeoplePage() {
  const [people, setPeople] =
    useState<Person[]>([]);

  const [selectedPerson, setSelectedPerson] =
    useState<Person | null>(null);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const loadPeople = useCallback(async () => {
    try {
      const data =
        await getPeople();

      setPeople(data);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load people.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleDelete(
    id: number,
    name: string,
  ) {
    const confirmed =
      window.confirm(
        `Delete ${name}?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await deletePerson(id);

      await loadPeople();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Delete failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const filtered =
    people.filter((person) => {
      const query =
        search.toLowerCase();

      return (
        person.full_name
          .toLowerCase()
          .includes(query) ||
        person.enrollment_no
          ?.toLowerCase()
          .includes(query) ||
        person.branch
          ?.toLowerCase()
          .includes(query)
      );
    });

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7168c9]">
            Directory
          </div>

          <h2 className="text-3xl font-bold tracking-tight">
            People
          </h2>

          <p className="mt-2 text-sm text-[#747c90]">
            Locally enrolled test profiles.
          </p>
        </div>

        <button
          onClick={loadPeople}
          className="flex items-center gap-2 self-start rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-sm text-[#b5bbca] transition hover:bg-white/[0.06] hover:text-white md:self-auto"
        >
          <RefreshCw size={16} />

          Refresh
        </button>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 text-sm text-[#fca5a5]">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d111b]">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] p-5 md:flex-row">
          <div>
            <div className="font-semibold">
              Enrolled Profiles
            </div>

            <div className="mt-1 text-xs text-[#6f778b]">
              {people.length} total profiles
            </div>
          </div>

          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555d70]"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search people..."
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-[#555d70] focus:border-[#6d5dfc]/40 md:w-72"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-white/[0.05] text-left text-[10px] uppercase tracking-wider text-[#626a7e]">
                <th className="px-5 py-4">
                  Person
                </th>

                <th className="px-5 py-4">
                  Role
                </th>

                <th className="px-5 py-4">
                  Enrollment
                </th>

                <th className="px-5 py-4">
                  Year
                </th>

                <th className="px-5 py-4">
                  Branch
                </th>

                <th className="px-5 py-4">
                  Status
                </th>

                <th className="px-5 py-4">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-sm text-[#626a7e]"
                  >
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-sm text-[#626a7e]"
                  >
                    No people found.
                  </td>
                </tr>
              ) : (
                filtered.map(
                  (person) => (
                    <tr
                      key={person.id}
                      onClick={() => setSelectedPerson(person)}
                      className="border-b border-white/[0.04] transition hover:bg-white/[0.03] cursor-pointer group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#6d5dfc]/10 text-[#9185ff]">
                            {person.face_image ? (
                              <img
                                src={person.face_image}
                                alt={person.full_name}
                                className="h-full w-full object-cover"
                              />
                            ) : person.role === "teacher" ? (
                              <UserRound size={16} />
                            ) : (
                              <GraduationCap size={17} />
                            )}
                          </div>

                          <div>
                            <div className="text-sm font-semibold text-white group-hover:text-[#a69eff] transition-colors">
                              {
                                person.full_name
                              }
                            </div>

                            <div className="mt-0.5 text-xs text-[#626a7e]">
                              ID #{person.id} • Click for ID Card
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm capitalize text-[#aab0bf]">
                        {person.role}
                      </td>

                      <td className="px-5 py-4 font-mono text-xs text-[#8e96aa]">
                        {person.enrollment_no ||
                          "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-[#8e96aa]">
                        {person.year ||
                          "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-[#8e96aa]">
                        {person.branch ||
                          "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            person.consent_status
                              ? "bg-[#22c55e]/10 text-[#86efac]"
                              : "bg-[#ef4444]/10 text-[#fca5a5]"
                          }`}
                        >
                          {person.consent_status
                            ? "ENROLLED"
                            : "NOT CONSENTED"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedPerson(person)}
                            title="View Full ID Card Details"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8b93a7] transition hover:bg-[#6d5dfc]/15 hover:text-[#a69eff]"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(
                                person.id,
                                person.full_name,
                              )
                            }
                            title="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#626a7e] transition hover:bg-[#ef4444]/10 hover:text-[#f87171]"
                          >
                            <Trash2
                              size={15}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ID Card Profile Details Modal */}
      <PersonDetailsModal
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
        onDelete={(id, name) => {
          setSelectedPerson(null);
          handleDelete(id, name);
        }}
      />
    </div>
  );
}