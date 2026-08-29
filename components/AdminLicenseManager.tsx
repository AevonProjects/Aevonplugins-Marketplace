"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type LicenseRow = {
  id: string;
  license_key: string;
  status: string;
  server_id?: string | null;
  activated_at?: string | null;
  last_validated_at?: string | null;
  created_at?: string | null;

  user_id?: string | null;
  plugin_id?: string | null;

  customer_email?: string | null;
  customer_name?: string | null;
  plugin_name?: string | null;
  plugin_version?: string | null;
};

export default function AdminLicenseManager() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  /*
   * Get the currently signed-in user's Supabase access token.
   *
   * IMPORTANT:
   * supabase can be undefined depending on configuration, so we check
   * it before calling auth.getSession().
   */
  const token = useCallback(async () => {
    if (!supabase) {
      return "";
    }

    const { data } = await supabase.auth.getSession();

    return data.session?.access_token || "";
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const accessToken = await token();

      if (!accessToken) {
        throw new Error("Authentication required.");
      }

      const response = await fetch("/api/admin/licenses", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            result?.message ||
            "Unable to load marketplace licenses."
        );
      }

      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result?.licenses)
          ? result.licenses
          : [];

      setLicenses(rows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load marketplace licenses."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredLicenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return licenses.filter((license) => {
      const matchesStatus =
        statusFilter === "all" ||
        license.status?.toLowerCase() === statusFilter.toLowerCase();

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        license.license_key,
        license.customer_email,
        license.customer_name,
        license.plugin_name,
        license.plugin_version,
        license.status,
        license.server_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [licenses, search, statusFilter]);

  async function performAction(
    licenseId: string,
    action: "activate" | "suspend" | "revoke" | "reset-server"
  ) {
    setMessage(null);
    setError(null);

    try {
      const accessToken = await token();

      if (!accessToken) {
        throw new Error("Authentication required.");
      }

      const response = await fetch(
        `/api/admin/licenses/${licenseId}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            result?.message ||
            "Unable to update this license."
        );
      }

      if (action === "activate") {
        setMessage("License activated successfully.");
      }

      if (action === "suspend") {
        setMessage("License suspended successfully.");
      }

      if (action === "revoke") {
        setMessage("License revoked successfully.");
      }

      if (action === "reset-server") {
        setMessage(
          "Server activation reset successfully. The license can now be activated on another server."
        );
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update this license."
      );
    }
  }

  function maskLicenseKey(key: string) {
    if (!key) {
      return "—";
    }

    if (key.length <= 12) {
      return key;
    }

    return `${key.slice(0, 8)}••••••${key.slice(-6)}`;
  }

  function formatDate(value?: string | null) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  }

  function statusLabel(status?: string) {
    switch (status?.toLowerCase()) {
      case "active":
        return "Active";

      case "suspended":
        return "Suspended";

      case "revoked":
        return "Revoked";

      default:
        return status || "Unknown";
    }
  }

  return (
    <section className="adminLicenseManager">
      <div className="adminSectionHeader">
        <div>
          <span className="eyebrow">LICENSE MANAGEMENT</span>

          <h2>Plugin Licenses</h2>

          <p>
            View and manage marketplace licenses, customers and server
            activations.
          </p>
        </div>

        <button
          type="button"
          className="secondaryButton"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="adminLicenseFilters">
        <input
          type="search"
          placeholder="Search customer, plugin or license..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All licenses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {message && <div className="successMessage">{message}</div>}

      {error && <div className="errorMessage">{error}</div>}

      {loading ? (
        <div className="emptyState">Loading plugin licenses...</div>
      ) : filteredLicenses.length === 0 ? (
        <div className="emptyState">
          No marketplace licenses matched your filters.
        </div>
      ) : (
        <div className="adminLicenseTableWrap">
          <table className="adminLicenseTable">
            <thead>
              <tr>
                <th>Plugin</th>
                <th>Customer</th>
                <th>License #</th>
                <th>Status</th>
                <th>Server</th>
                <th>Activated</th>
                <th>Last Validated</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredLicenses.map((license) => {
                const status = license.status?.toLowerCase();
                const serverBound = Boolean(license.server_id);

                return (
                  <tr key={license.id}>
                    <td>
                      <strong>{license.plugin_name || "Unknown Plugin"}</strong>

                      {license.plugin_version && (
                        <small>v{license.plugin_version}</small>
                      )}
                    </td>

                    <td>
                      <strong>
                        {license.customer_name ||
                          license.customer_email ||
                          "Unknown Customer"}
                      </strong>

                      {license.customer_name && license.customer_email && (
                        <small>{license.customer_email}</small>
                      )}
                    </td>

                    <td>
                      <code title={license.license_key}>
                        {maskLicenseKey(license.license_key)}
                      </code>
                    </td>

                    <td>
                      <span
                        className={`licenseStatus licenseStatus-${status || "unknown"}`}
                      >
                        {statusLabel(license.status)}
                      </span>
                    </td>

                    <td>
                      {serverBound ? (
                        <span title={license.server_id || undefined}>
                          🔒 Bound
                        </span>
                      ) : (
                        <span>Ready for activation</span>
                      )}
                    </td>

                    <td>{formatDate(license.activated_at)}</td>

                    <td>{formatDate(license.last_validated_at)}</td>

                    <td>
                      <div className="licenseActions">
                        {status !== "active" && (
                          <button
                            type="button"
                            onClick={() =>
                              performAction(license.id, "activate")
                            }
                          >
                            Activate
                          </button>
                        )}

                        {status === "active" && (
                          <button
                            type="button"
                            onClick={() =>
                              performAction(license.id, "suspend")
                            }
                          >
                            Suspend
                          </button>
                        )}

                        {status !== "revoked" && (
                          <button
                            type="button"
                            onClick={() =>
                              performAction(license.id, "revoke")
                            }
                          >
                            Revoke
                          </button>
                        )}

                        {serverBound && (
                          <button
                            type="button"
                            onClick={() => {
                              const confirmed = window.confirm(
                                "Reset this server activation? The customer will be able to activate this license on another server."
                              );

                              if (confirmed) {
                                performAction(license.id, "reset-server");
                              }
                            }}
                          >
                            Reset Server
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}