
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

// Админы эрх шалгах
async function checkAdmin(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  try {
    const token = authorization.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    const adminUid = process.env.ADMIN_UID?.trim();

    return !!adminUid && decoded.uid === adminUid;
  } catch (error) {
    console.error("TOKEN VERIFY ERROR:", error);
    return false;
  }
}

// БАГШ НЭМЭХ
export async function POST(request: Request) {
  let createdUid: string | null = null;

  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json(
        { error: "Админы эрх шаардлагатай." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const phone = String(body.phone ?? "").replace(/\D/g, "");
    const password = String(body.password ?? "");

    if (!name || !subject || !phone || password.length < 6) {
      return NextResponse.json(
        {
          error:
            "Мэдээллээ бүрэн оруулна уу. Нууц үг дор хаяж 6 тэмдэгт байна.",
        },
        { status: 400 }
      );
    }

    // Утасны дугаар давхардсан эсэх
    const duplicate = await adminDb
      .collection("teachers")
      .where("phone", "==", phone)
      .limit(1)
      .get();

    if (!duplicate.empty) {
      return NextResponse.json(
        { error: "Энэ утасны дугаар бүртгэлтэй байна." },
        { status: 409 }
      );
    }

    const email = `bagsh.${phone}@login.student-attendance.mn`;

    // Firebase Auth хэрэглэгч үүсгэх
    const user = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    createdUid = user.uid;

    const teacherRef = adminDb.collection("teachers").doc();
    const batch = adminDb.batch();

    // Үндсэн багшийн мэдээлэл
    batch.set(teacherRef, {
      name,
      subject,
      phone,
      role: "teacher",
      uid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Firestore Rules-д ашиглах эрхийн бүртгэл
    batch.set(adminDb.collection("teacherAccess").doc(user.uid), {
      uid: user.uid,
      role: "teacher",
      createdAt: FieldValue.serverTimestamp(),
    });

    // Хуучин users бүртгэлийг одоогоор хадгалж үлдээнэ
    batch.set(adminDb.collection("users").doc(user.uid), {
      name,
      phone,
      role: "teacher",
      uid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      teacherId: teacherRef.id,
      uid: user.uid,
    });
  } catch (error: any) {
    console.error("БАГШ ҮҮСГЭХ АЛДАА:", error);

    // Firestore хадгалалт амжилтгүй бол Auth хэрэглэгчийг цэвэрлэх
    if (createdUid) {
      await adminAuth.deleteUser(createdUid).catch(() => {});
    }

    if (error.code === "auth/email-already-exists") {
      return NextResponse.json(
        {
          error:
            "Энэ утасны дугаартай нэвтрэх эрх өмнө нь үүссэн байна.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Багш үүсгэж чадсангүй. Тохиргоо болон эрхээ шалгана уу.",
      },
      { status: 500 }
    );
  }
}

// БАГШ УСТГАХ
export async function DELETE(request: Request) {
  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json(
        { error: "Админы эрх шаардлагатай." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const teacherId = String(body.teacherId ?? "").trim();

    if (!teacherId) {
      return NextResponse.json(
        { error: "Багшийн ID олдсонгүй." },
        { status: 400 }
      );
    }

    const teacherRef = adminDb.collection("teachers").doc(teacherId);
    const teacherDoc = await teacherRef.get();

    if (!teacherDoc.exists) {
      return NextResponse.json(
        { error: "Багш олдсонгүй." },
        { status: 404 }
      );
    }

    const uid = teacherDoc.data()?.uid;

    if (!uid) {
      return NextResponse.json(
        { error: "Багшийн UID олдсонгүй." },
        { status: 409 }
      );
    }

    // Firebase Authentication хэрэглэгчийг устгах
    try {
      await adminAuth.deleteUser(uid);
    } catch (error: any) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    // Багшийн бүх Firestore бүртгэлийг хамт устгах
    const batch = adminDb.batch();

    batch.delete(teacherRef);
    batch.delete(adminDb.collection("teacherAccess").doc(uid));
    batch.delete(adminDb.collection("users").doc(uid));

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: "Багшийн бүртгэл бүрэн устгагдлаа.",
    });
  } catch (error) {
    console.error("БАГШ УСТГАХ АЛДАА:", error);

    return NextResponse.json(
      { error: "Багш устгахад алдаа гарлаа." },
      { status: 500 }
    );
  }
}
