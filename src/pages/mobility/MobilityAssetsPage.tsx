import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  supabase,
  MobilityAsset,
  Personnel,
  Unit,
  MobilityPhoto,
} from "../../lib/supabase";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../components/AuthProvider";
import {
  Car,
  Search,
  RefreshCcw,
  Plus,
  X,
  AlertCircle,
  Table,
  FileSpreadsheet,
} from "lucide-react";
import MobilityFormModal from "./MobilityFormModal";
import {
  getMaintenanceReminders,
  getMaintenanceSummary,
} from "../utils/maintenanceStatus";
import MaintenanceHistoryModal from "../history/MaintenanceHistoryModal";
import MobilityTable from "./MobilityTable";
import ConfirmDeleteModal from "../../helper/ConfirmDeleteModal";
import MobilityAssetViewModal from "./MobilityAssetViewModal";
import DriverLicenseModal, {
  DriverLicensePersonnel,
} from "./DriverLicenseModal";

import * as XLSX from "xlsx";

type VehicleForm = {
  plate_number: string;
  vehicle_type: string;
  unit_id: string;

  description: string;
  status: string;

  current_odometer: number;

  year_model: string;

  or_number: string;
  cr_number: string;
  engine_number: string;
  chassis_number: string;

  source: "Organic" | "Loaned" | "Donated";
  date_of_last_registration: string;
  date_registration_expires: string;

  insurance_provider: string;
  insurance_coverage_date: string;

  driver_id: string;
  remarks: string;

  photos: File[];
  //existing_photos: MobilityPhoto[];
};

const emptyForm: VehicleForm = {
  plate_number: "",
  vehicle_type: "",
  unit_id: "",

  description: "",
  status: "Serviceable",

  current_odometer: 0,

  year_model: "",

  or_number: "",
  cr_number: "",
  engine_number: "",
  chassis_number: "",

  source: "Organic",

  date_of_last_registration: "",
  date_registration_expires: "",

  insurance_provider: "",
  insurance_coverage_date: "",

  driver_id: "",
  remarks: "",

  photos: [],
  //existing_photos: [],
};

type DriverLicenseModalMode = "view" | "edit";

export default function MobilityAssetsPage() {
  const navigate = useNavigate();
  const { isAdmin, unitId, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [vehicles, setVehicles] = useState<MobilityAsset[]>([]);
  const [unitList, setUnitList] = useState<Unit[]>([]);
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<MobilityAsset | null>(
    null,
  );
  const [formData, setFormData] = useState<VehicleForm>({
    ...emptyForm,
    unit_id: unitId ?? "",
  });

  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  // query string from url
  const [searchParams] = useSearchParams();
  const queryString = searchParams.get("query") ?? "";

  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );
  const [mobilityPhotos, setMobilityPhotos] = useState<File[]>([]);

  const [existingMobilityPhotos, setExistingMobilityPhotos] = useState<
    MobilityPhoto[]
  >([]);

  const [viewAsset, setViewAsset] = useState<MobilityAsset | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [selectedDriverForLicense, setSelectedDriverForLicense] =
    useState<DriverLicensePersonnel | null>(null);
  const [licenseModalMode, setLicenseModalMode] =
    useState<DriverLicenseModalMode>("view");

  const [showDriverLicenseModal, setShowDriverLicenseModal] = useState(false);

  const handleCloseView = () => {
    setIsViewModalOpen(false);
    setViewAsset(null);
  };

  const handleView = (asset: MobilityAsset) => {
    setViewAsset(asset);
    setIsViewModalOpen(true);
  };

  const handleViewDriverLicense = (driver: Personnel | null | undefined) => {
    if (!driver) return;

    setSelectedDriverForLicense({
      id: driver.id,
      rank: driver.rank?.rank_name ?? "",
      fullname: driver.fullname,

      drivers_license_no: driver.drivers_license_no ?? null,

      drivers_license_expiration: driver.drivers_license_expiration ?? null,

      drivers_license_type: driver.drivers_license_type ?? null,

      drivers_license_transmission: driver.drivers_license_transmission ?? null,

      drivers_license_restrictions: driver.drivers_license_restrictions ?? null,

      drivers_license_photo_path: driver.drivers_license_photo_path ?? null,
    });
    setShowDriverLicenseModal(true);
  };

  const handleSaveDriverLicense = async (data: {
    drivers_license_no: string;
    drivers_license_expiration: string;
    drivers_license_type: string;
    drivers_license_transmission: "MANUAL" | "AUTOMATIC" | "BOTH";
    drivers_license_restrictions: string[];
    drivers_license_photo: File | null;
  }) => {
    if (!selectedDriverForLicense) return;
    let newPhotoPath: string | null = null;

    try {
      /*
       * 1. Upload the new photo if one was selected
       */
      if (data.drivers_license_photo) {
        const file = data.drivers_license_photo;

        const fileExtension =
          file.name.split(".").pop()?.toLowerCase() ?? "jpg";

        const fileName = `${crypto.randomUUID()}.${fileExtension}`;

        /*
         * You can organize the files by personnel ID.
         */
        newPhotoPath = `${selectedDriverForLicense?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("drivers-licenses")
          .upload(newPhotoPath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw uploadError;
        }
      }

      /*
       * 2. Update the personnel record
       */
      const { error: updateError } = await supabase
        .from("personnel")
        .update({
          drivers_license_no: data.drivers_license_no,

          drivers_license_expiration: data.drivers_license_expiration,

          drivers_license_type: data.drivers_license_type,

          drivers_license_transmission: data.drivers_license_transmission,

          drivers_license_restrictions: data.drivers_license_restrictions,

          /*
           * Only replace the path if a new photo
           * was actually uploaded.
           */
          ...(newPhotoPath
            ? {
                drivers_license_photo_path: newPhotoPath,
              }
            : {}),
        })
        .eq("id", selectedDriverForLicense?.id);

      if (updateError) {
        /*
         * Database update failed.
         *
         * Delete the newly uploaded photo so
         * we don't leave an orphaned file.
         */
        if (newPhotoPath) {
          await supabase.storage
            .from("drivers-licenses")
            .remove([newPhotoPath]);
        }

        throw updateError;
      }

      /*
       * 3. Delete the OLD photo only after
       *    everything succeeded.
       */
      if (newPhotoPath && selectedDriverForLicense.existing_photo_path) {
        const { error: deleteError } = await supabase.storage
          .from("drivers-licenses")
          .remove([selectedDriverForLicense.existing_photo_path]);

        if (deleteError) {
          /*
           * Don't fail the whole save because
           * the database and new image are already
           * successfully saved.
           */
          console.error(
            "Failed to delete old driver's license photo:",
            deleteError,
          );
        }
      }

      setLicenseModalMode("view");
      setSelectedDriverForLicense(null);
      setSuccess("Successfully saved!");

      await fetchMobility();
    } catch (error) {
      console.error("Failed to save driver's license:", error);

      throw error;
    }
  };

  useEffect(() => {
    if (!isAdmin && unitId) {
      setFormData((prev) => ({
        ...prev,
        unit_id: unitId,
      }));
    }
  }, [isAdmin, unitId, queryString]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, unitFilter]);

  useEffect(() => {
    if (error || success) {
      // Automatically clear the error after 5 seconds (5000ms)
      const timer = setTimeout(() => {
        setError(null); // Replace setError with whatever your state setter is named
        setSuccess(null);
      }, 8000);

      // Clean up the timer if the component unmounts or if error changes before 5s
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  useEffect(() => {
    setCurrentPage(1);
    loadPage();
  }, [unitFilter, unitId, isAdmin]);

  const loadPage = async () => {
    setLoading(true);

    try {
      await Promise.all([fetchMobility(), fetchUnits(), fetchPersonnel()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from("unit")
      .select("*")
      .order("level", { ascending: false })
      .order("unit_name", { ascending: true });

    if (!error && data) {
      setUnitList(data);
    }
  };

  const fetchPersonnel = async () => {
    let allPersonnel: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("personnel")
        .select("*, rank(*), unit(*)")
        .order("fullname", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!isAdmin && unitId) {
        query = query.eq("unit_id", unitId);
      } else if (unitFilter) {
        query = query.eq("unit_id", unitFilter);
      }

      const { data, error } = await query;

      if (error || !data) {
        console.error("Error fetching personnel:", error);
        break;
      }

      allPersonnel = [...allPersonnel, ...data];

      // Stop fetching if the last batch returned fewer rows than the page size
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }

    setPersonnelList(allPersonnel);
  };

  const fetchMobility = async () => {
    let query = supabase
      .from("mobility_assets")
      .select(
        `
        *,
        updated_by_personnel:personnel!mobility_assets_updated_by_fkey(
          *,
          rank(*)
        ),
        unit(
          id,
          unit_name
        ),
        driver:personnel!mobility_assets_driver_id_fkey(
          *,
          rank(*)
        ),
        maintenance_history:mobility_assets_maintenance_history(
          *,
          items:mobility_assets_maintenance_history_items(
            *,
            maintenance_type:maintenance_types(*)
          )
        ),
        photos: mobility_photos(
          *
        )
      `,
      )
      .order("changed_at", {
        referencedTable: "mobility_assets_maintenance_history",
        ascending: false,
      })
      .order("plate_number");

    if (!isAdmin && unitId) {
      query = query.eq("unit_id", unitId);
    } else if (unitFilter) {
      query = query.eq("unit_id", unitFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return;
    }

    const mobilityWithReminder = (data ?? []).map((vehicle) => {
      const latest = [...(vehicle.maintenance_history ?? [])].sort(
        (a, b) =>
          new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
      );

      const reminders = getMaintenanceReminders(
        latest,
        vehicle.current_odometer,
      );

      return {
        ...vehicle,

        maintenance_reminders: reminders,
        maintenance_summary: getMaintenanceSummary(reminders),

        searchText: [
          vehicle.plate_number,
          vehicle.vehicle_type,
          vehicle.description,
          vehicle.status,
          vehicle.year_model,
          vehicle.engine_number,
          vehicle.chassis_number,
          vehicle.or_number,
          vehicle.cr_number,
          vehicle.insurance_provider,
          vehicle.unit?.unit_name,
          vehicle.driver?.fullname,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });

    // Keep the original data
    setVehicles(mobilityWithReminder);
  };

  const filteredMobilities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const today = new Date();

    return vehicles.filter((vehicle) => {
      // -----------------------------
      // Dashboard / Summary Card Filter
      // -----------------------------
      switch (queryString) {
        case "Serviceable":
        case "Unserviceable":
        case "BER":
          if (vehicle.status !== queryString) {
            return false;
          }
          break;

        case "Organic":
        case "Donated":
        case "Loaned":
          if (vehicle.source !== queryString) {
            return false;
          }
          break;

        case "Due for Registration": {
          if (!vehicle.date_registration_expires) {
            return false;
          }

          const daysRemaining = Math.ceil(
            (new Date(vehicle.date_registration_expires).getTime() -
              today.getTime()) /
              (1000 * 60 * 60 * 24),
          );

          if (daysRemaining > 30) {
            return false;
          }

          break;
        }

        case "Renewal of Insurance": {
          if (!vehicle.insurance_coverage_date) {
            return false;
          }

          const daysRemaining = Math.ceil(
            (new Date(vehicle.insurance_coverage_date).getTime() -
              today.getTime()) /
              (1000 * 60 * 60 * 24),
          );

          if (daysRemaining > 30) {
            return false;
          }

          break;
        }

        case "Due for PMS": {
          const summary = vehicle.maintenance_summary;

          if (!summary || (!summary.dueSoon && !summary.overdue)) {
            return false;
          }

          break;
        }

        default:
          if (
            queryString &&
            queryString !== "All" &&
            vehicle.vehicle_type !== queryString
          ) {
            return false;
          }
      }

      // -----------------------------
      // Search Filter
      // -----------------------------
      if (!q) {
        return true;
      }

      return (
        vehicle.plate_number?.toLowerCase().includes(q) ||
        vehicle.vehicle_type?.toLowerCase().includes(q) ||
        vehicle.description?.toLowerCase().includes(q) ||
        vehicle.status?.toLowerCase().includes(q) ||
        vehicle.year_model?.toLowerCase().includes(q) ||
        vehicle.engine_number?.toLowerCase().includes(q) ||
        vehicle.chassis_number?.toLowerCase().includes(q) ||
        vehicle.or_number?.toLowerCase().includes(q) ||
        vehicle.cr_number?.toLowerCase().includes(q) ||
        vehicle.insurance_provider?.toLowerCase().includes(q) ||
        vehicle.unit?.unit_name?.toLowerCase().includes(q) ||
        vehicle.driver?.fullname?.toLowerCase().includes(q)
      );
    });
  }, [vehicles, queryString, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMobilities.length / PAGE_SIZE),
  );

  const paginatedMobilities = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredMobilities.slice(start, start + PAGE_SIZE);
  }, [filteredMobilities, currentPage]);

  const resetForm = () => {
    setFormData({
      ...emptyForm,
      unit_id: !isAdmin && unitId ? unitId : "",
    });
  };

  const populateForm = async (vehicle: MobilityAsset) => {
    setFormData({
      plate_number: vehicle.plate_number ?? "",
      vehicle_type: vehicle.vehicle_type ?? "",
      unit_id: vehicle.unit_id ?? "",

      description: vehicle.description ?? "",
      status: vehicle.status ?? "Serviceable",

      current_odometer: vehicle.current_odometer ?? 0,

      year_model: vehicle.year_model ?? "",

      or_number: vehicle.or_number ?? "",
      cr_number: vehicle.cr_number ?? "",
      engine_number: vehicle.engine_number ?? "",
      chassis_number: vehicle.chassis_number ?? "",

      source: vehicle.source ?? "Organic",

      date_of_last_registration: vehicle.date_of_last_registration ?? "",
      date_registration_expires: vehicle.date_registration_expires ?? "",

      insurance_provider: vehicle.insurance_provider ?? "",

      insurance_coverage_date: vehicle.insurance_coverage_date ?? "",

      driver_id: vehicle.driver_id ?? "",
      remarks: vehicle.remarks ?? "",

      photos: [],
    });

    setExistingMobilityPhotos(vehicle.photos);
    // Load existing photos
    const { data: photos, error } = await supabase
      .from("mobility_photos")
      .select("*")
      .eq("mobility_id", vehicle.id)
      .order("photo_order", { ascending: true });

    if (error) {
      console.error("Error loading mobility photos:", error);
      setExistingMobilityPhotos([]);
    } else {
      setExistingMobilityPhotos(photos ?? []);
    }

    setEditingVehicle(vehicle);
  };

  const closeModal = () => {
    setEditingVehicle(null);
    setShowAddModal(false);
    resetForm();
  };

  const handleInputChange = <K extends keyof VehicleForm>(
    key: K,
    value: VehicleForm[K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleAddMobility = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    try {
      // Separate photos because they do NOT belong
      // to the mobility_assets table.
      const { photos, ...mobilityData } = formData;

      const mobility_asset = {
        ...mobilityData,

        description: formData.description || null,
        year_model: formData.year_model || null,
        or_number: formData.or_number || null,
        cr_number: formData.cr_number || null,
        engine_number: formData.engine_number || null,
        chassis_number: formData.chassis_number || null,

        date_of_last_registration: formData.date_of_last_registration || null,

        date_registration_expires: formData.date_registration_expires || null,

        insurance_provider: formData.insurance_provider || null,

        insurance_coverage_date: formData.insurance_coverage_date || null,

        driver_id: formData.driver_id || null,

        updated_by: profile?.id,

        remarks: formData.remarks || null,
      };

      // 1. Create mobility asset
      const { data, error } = await supabase
        .from("mobility_assets")
        .insert([mobility_asset])
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      // 2. Upload photos after mobility has been created
      if (photos.length > 0) {
        await uploadMobilityPhotos(data.id, photos);
      }

      // 3. Refresh mobility list
      await fetchMobility();

      setSuccess("Successfully added!");

      // 4. Close modal
      closeModal();
    } catch (err: any) {
      console.error("Failed to add mobility:", err);

      alert(err.message || "Failed to add mobility.");
    }
  };

  const handleUpdateVehicle = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!editingVehicle) return;

    try {
      // Separate photos from the mobility_assets data.
      // `photos` belongs to mobility_photos / Storage,
      // NOT mobility_assets.
      const { photos, ...mobilityData } = formData;

      const { error } = await supabase
        .from("mobility_assets")
        .update({
          ...mobilityData,

          description: formData.description || null,
          year_model: formData.year_model || null,
          or_number: formData.or_number || null,
          cr_number: formData.cr_number || null,
          engine_number: formData.engine_number || null,
          chassis_number: formData.chassis_number || null,

          date_of_last_registration: formData.date_of_last_registration || null,

          date_registration_expires: formData.date_registration_expires || null,

          insurance_provider: formData.insurance_provider || null,

          insurance_coverage_date: formData.insurance_coverage_date || null,

          driver_id: formData.driver_id || null,

          updated_by: profile?.id,

          remarks: formData.remarks || null,
        })
        .eq("id", editingVehicle.id);

      if (error) {
        throw error;
      }

      // Only replace the existing photos if the user
      // selected new photos.
      if (photos.length > 0) {
        // await deleteMobilityPhotos(editingVehicle.id);

        await uploadMobilityPhotos(editingVehicle.id, photos);
      }

      await fetchMobility();

      setSuccess("Successfully updated!");

      closeModal();
    } catch (err: any) {
      console.error("Failed to update mobility:", err);

      alert(err.message || "Failed to update mobility.");
    }
  };

  const uploadMobilityPhotos = async (mobilityId: string, files: File[]) => {
    if (!files.length) return;

    // Get existing photos first
    const { data: existingPhotos, error: existingError } = await supabase
      .from("mobility_photos")
      .select("photo_order")
      .eq("mobility_id", mobilityId)
      .order("photo_order", { ascending: true });

    if (existingError) throw existingError;

    const usedOrders = new Set(
      (existingPhotos ?? []).map((photo) => photo.photo_order),
    );

    // Find available slots from 1 to 4
    const availableOrders = [1, 2, 3, 4].filter(
      (order) => !usedOrders.has(order),
    );

    if (files.length > availableOrders.length) {
      throw new Error(
        `Only ${availableOrders.length} photo slot(s) remaining. Maximum is 4 photos.`,
      );
    }

    const records = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const photoOrder = availableOrders[i];

      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";

      const filePath = `${mobilityId}/${photoOrder}-${crypto.randomUUID()}.${extension}`;

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from("mobility-photos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      records.push({
        mobility_id: mobilityId,
        storage_path: filePath,
        photo_order: photoOrder,
      });
    }

    // Insert database records
    const { error: insertError } = await supabase
      .from("mobility_photos")
      .insert(records);

    if (insertError) {
      // Clean up uploaded files if DB insert fails
      await supabase.storage
        .from("mobility-photos")
        .remove(records.map((record) => record.storage_path));

      throw insertError;
    }
  };

  const handleRemoveExistingPhoto = async (photo: MobilityPhoto) => {
    if (!photo.id) return;

    if (!window.confirm(`Are you sure you want to this photo?`)) {
      return;
    }

    try {
      // Delete the actual file from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from("mobility-photos")
        .remove([photo.storage_path]);

      if (storageError) {
        throw storageError;
      }

      // Delete the database record
      const { error: dbError } = await supabase
        .from("mobility_photos")
        .delete()
        .eq("id", photo.id);

      if (dbError) {
        throw dbError;
      }

      // Remove it from the UI immediately
      setExistingMobilityPhotos((prev) =>
        prev.filter((item) => item.id !== photo.id),
      );
    } catch (error: any) {
      console.error("Error removing mobility photo:", error);
      alert(error.message || "Failed to remove photo.");
    }
  };

  const handleConfirmDelete = async (word: string) => {
    if (!selectedVehicleId) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      if (word !== "DELETE") {
        setDeleteError("Incorrect word.");
        return;
      }

      await handleDeleteMobility(selectedVehicleId);

      setShowDeleteModal(false);
      setSelectedVehicleId(null);
    } catch (err) {
      console.error(err);
      setDeleteError("Unable to delete record.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteMobility = async (id: string) => {
    try {
      const { error } = await supabase
        .from("mobility_assets")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await fetchMobility();
      setSuccess("Successfully deleted!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "Serviceable":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";

      case "Under Maintenance":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";

      case "Unserviceable":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";

      case "Beyond Economic Repair":
        return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";

      default:
        return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const isExpired = (date?: string | null) => {
    if (!date) return false;

    return new Date(date) < new Date();
  };

  const isExpiringSoon = (date?: string | null, days = 30) => {
    if (!date) return false;

    const target = new Date(date);

    const warning = new Date();

    warning.setDate(warning.getDate() + days);

    return target >= new Date() && target <= warning;
  };

  const handleExportExcel = () => {
    if (!vehicles.length) {
      setError("No data available to export.");
      return;
    }

    try {
      const exportData = vehicles.map((vehicle) => ({
        "Plate Number": vehicle.plate_number || "-",
        "Mobility Type": vehicle.vehicle_type || "-",
        Description: vehicle.description || "-",
        "Year Model": vehicle.year_model || "-",
        Source: vehicle.source || "-",
        Status: vehicle.status || "-",

        "Unit/Station": vehicle.unit?.unit_name || "-",

        "Official Driver": vehicle.driver
          ? `${vehicle.driver.rank?.rank_name ?? ""} ${
              vehicle.driver.fullname ?? ""
            }`.trim()
          : "-",

        "Current Odometer": vehicle.current_odometer ?? 0,

        "OR Number": vehicle.or_number || "-",
        "CR Number": vehicle.cr_number || "-",

        "Engine Number": vehicle.engine_number || "-",
        "Chassis Number": vehicle.chassis_number || "-",

        "Last Registration": vehicle.date_of_last_registration || "-",
        "Registration Expires": vehicle.date_registration_expires || "-",

        "Insurance Provider": vehicle.insurance_provider || "-",
        "Insurance Coverage Until": vehicle.insurance_coverage_date || "-",

        Remarks: vehicle.remarks || "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Mobility Assets");

      XLSX.writeFile(
        workbook,
        `Mobility_Assets_${new Date().toISOString().split("T")[0]}.xlsx`,
      );

      setSuccess("Successfully exported.");
    } catch (error) {
      setError("Cannot export data: " + error);
    }
  };

  return (
    <div className="flex flex-col gap-6 px-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            Mobility Assets
          </p>

          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Manage all mobility assets in your unit/station
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-72 rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {isAdmin && (
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="">All Units</option>

              {unitList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unit_name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              if (queryString) {
                navigate(`/mobility-assets`);
              }
            }}
            className="rounded-xl border border-slate-200 bg-white p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 dark:border-slate-800 dark:bg-slate-900"
          >
            <RefreshCcw className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate("/reports/mobility-distribution")}
            className="rounded-xl border border-slate-200 bg-white p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 dark:border-slate-800 dark:bg-slate-900"
          >
            <Table className="h-5 w-5" />
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 font-semibold text-white transition hover:bg-green-700"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Table */}

      {loading ? (
        <div className="flex h-[70vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCcw className="h-10 w-10 animate-spin text-blue-600" />

            <p className="text-slate-500">Loading mobility assets...</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="p-4 text-center">Plate Number</th>
                  <th className="p-4 text-center">Mobility</th>
                  <th className="p-4 text-center">Unit/Station</th>
                  <th className="p-4 text-center">Official Driver</th>
                  <th className="p-4 text-center">Odometer Reading</th>
                  <th className="p-4 text-center">Registration Expires</th>
                  <th className="p-4 text-center">Insurance</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>

              <MobilityTable
                vehicles={paginatedMobilities}
                onEdit={populateForm}
                onDelete={(id) => {
                  setSelectedVehicleId(id);
                  setError("");
                  setShowDeleteModal(true);
                }}
                getStatusColor={getStatusColor}
                isExpired={isExpired}
                isExpiringSoon={isExpiringSoon}
                handleView={handleView}
                handleViewDriverLicense={handleViewDriverLicense}
                currentPage={currentPage}
                pageSize={PAGE_SIZE}
              />
            </table>

            <div className="mt-6 flex items-center justify-between p-2 px-4">
              <div className="text-black dark:text-slate-300">
                Showing{" "}
                <strong>
                  {filteredMobilities.length === 0
                    ? 0
                    : (currentPage - 1) * PAGE_SIZE + 1}
                </strong>{" "}
                to{" "}
                <strong>
                  {Math.min(currentPage * PAGE_SIZE, filteredMobilities.length)}
                </strong>{" "}
                of <strong>{filteredMobilities.length}</strong> vehicles
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border px-4 py-2 disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="font-medium">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="rounded-lg border px-4 py-2 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          Add Vehicle Modal
    ========================= */}

      {success && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-green-50 dark:bg-green-900 border border-green-500 dark:border-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          {/* Alert Icon */}
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          {/* Error Text Message */}
          <div className="flex-1">
            <p className="font-medium">Mobility Assets</p>
            <p className="opacity-90 mt-0.5">{success}</p>
          </div>

          {/* Manual Dismiss Button */}
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
            }} // Clears the state instantly
            className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-red-500 dark:bg-red-900 border border-red-100 dark:border-red-900/30 text-white rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          {/* Alert Icon */}
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          {/* Error Text Message */}
          <div className="flex-1">
            <p className="font-medium">Mobility Assets</p>
            <p className="opacity-90 mt-0.5">{error}</p>
          </div>

          {/* Manual Dismiss Button */}
          <button
            type="button"
            onClick={() => {
              setError(null);
            }} // Clears the state instantly
            className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-white transition-colors shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <MobilityFormModal
        open={showAddModal || !!editingVehicle}
        editingVehicle={!!editingVehicle}
        formData={formData}
        mobilityPhotos={mobilityPhotos}
        existingPhotos={existingMobilityPhotos}
        onPersonnelUpdated={(updatedPersonnel) => {
          setPersonnelList((prev) =>
            prev.map((person) =>
              person.id === updatedPersonnel.id ? updatedPersonnel : person,
            ),
          );
        }}
        unitList={unitList}
        personnelList={personnelList}
        closeModal={closeModal}
        handleInputChange={handleInputChange}
        handleAddVehicle={handleAddMobility}
        handleUpdateVehicle={handleUpdateVehicle}
        handleRemoveExistingPhoto={handleRemoveExistingPhoto}
        getStatusColor={getStatusColor}
      />

      <MaintenanceHistoryModal
        open={showMaintenanceModal}
        vehicle={selectedVehicle}
        onClose={() => {
          setShowMaintenanceModal(false);
          setSelectedVehicle(null);
        }}
      />

      <ConfirmDeleteModal
        open={showDeleteModal}
        loading={deleteLoading}
        error={deleteError || ""}
        onClose={() => {
          setDeleteLoading(false);
          setDeleteError("");
          setShowDeleteModal(false);
        }}
        onConfirm={handleConfirmDelete}
      />

      <MobilityAssetViewModal
        asset={viewAsset}
        isOpen={isViewModalOpen}
        onClose={handleCloseView}
      />

      {showDriverLicenseModal && selectedDriverForLicense && (
        <DriverLicenseModal
          personnel={selectedDriverForLicense}
          mode={licenseModalMode}
          onClose={() => {
            setShowDriverLicenseModal(false);
            setSelectedDriverForLicense(null);
          }}
          onSave={handleSaveDriverLicense}
          onEdit={() => {
            setLicenseModalMode("edit");
          }}
        />
      )}
    </div>
  );
}
