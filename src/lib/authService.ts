import { supabase } from "./supabase";

export interface Personnel {
  id: string | null; // foreign key to auth.users
  badge_number: string | null;
  fullname: string;
  designation: string | null;
  unit_id: string;
  rank_id: string | null; // foreign key to ranks table
  photo_url: string | null;
}

/**
 * Validates that a personnel record exists for the given badge number and is ready for registration.
 * @param badgeNumber The badge number to validate
 * @returns An object containing the personnel data (if valid) and any error message
 */
export const validatePersonnelForRegistration = async (badgeNumber: string) => {
  const { data, error } = await supabase
    .from("personnel")
    .select(
      "id, badge_number, fullname, designation, unit_id, rank_id, photo_url",
    )
    .eq("badge_number", badgeNumber)
    .single();

  if (error) {
    // Handle the case where no row is found
    if (error.code === "PGRST116") {
      // PGRST116: No rows returned
      return {
        personnel: null,
        error: "Badge number is not registered.",
      };
    }
    // For other errors
    return {
      personnel: null,
      error: "An error occurred while validating the badge number.",
    };
  }

  const personnel = data;

  // Check that required fields are present and non-empty (where applicable)
  // Based on schema: badge_number can be null, designation can be null, rank_id can be null
  // But for registration, we require them to have values
  if (!personnel.badge_number || personnel.badge_number.trim() === "") {
    return {
      personnel: null,
      error: "Personnel record is incomplete: badge number is missing.",
    };
  }

  if (!personnel.fullname || personnel.fullname.trim() === "") {
    return {
      personnel: null,
      error: "Personnel record is incomplete: full name is missing.",
    };
  }

  if (!personnel.designation || personnel.designation.trim() === "") {
    return {
      personnel: null,
      error: "Personnel record is incomplete: designation is missing.",
    };
  }

  if (!personnel.unit_id || personnel.unit_id.trim() === "") {
    return {
      personnel: null,
      error: "Personnel record is incomplete: unit ID is missing.",
    };
  }

  if (!personnel.rank_id || personnel.rank_id.trim() === "") {
    return {
      personnel: null,
      error: "Personnel record is incomplete: rank ID is missing.",
    };
  }

  // Check if already linked to an auth user
  if (personnel.id !== null) {
    const { data: user } = await supabase.auth.admin.getUserById(personnel.id);
    if (user.user) {
      return {
        personnel: null,
        error: "This personnel has already been registered.",
      };
    }
  }

  return { personnel, error: null };
};

/**
 * Links an authenticated user to an existing personnel record.
 * @param badgeNumber The personnel's badge number
 * @param rankId The personnel's rank ID (foreign key to ranks table)
 * @param unitId The personnel's unit ID
 * @param authUserId The ID of the authenticated user (from Supabase Auth)
 * @param email The email address to associate with the personnel record
 * @returns An object containing any error that occurred
 */
export const linkAuthUserToPersonnel = async (
  badgeNumber: string,
  rankId: string,
  unitId: string,
  authUserId: string,
  phone_number: string,
  viber_number: string,
  photoUrl: string | null,
  id_card_number: string,
  date_issued: string,
  expiration_date: string,
) => {
  const { error } = await supabase
    .from("personnel")
    .update({
      id: authUserId, // This is the foreign key to auth.users
      photo_url: photoUrl,
      phone_number: phone_number,
      viber_number: viber_number,
      id_card_number: id_card_number,
      date_issued: date_issued,
      expiration_date: expiration_date,
      role: "supply",
    })
    .eq("badge_number", badgeNumber)
    .eq("rank_id", rankId)
    .eq("unit_id", unitId);

  return { error };
};
