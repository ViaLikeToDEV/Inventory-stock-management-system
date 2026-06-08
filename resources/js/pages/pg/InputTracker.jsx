import { useEffect, useRef } from "react";
import Swal from "sweetalert2";

export default function FocusTracker() {
  const hasInteracted = useRef(false);
  const alertShown = useRef(false);
  const swalTimer = useRef(null); // เก็บ timer สำหรับ auto-close

  useEffect(() => {
    const handleClick = () => {
      hasInteracted.current = true;
    };

    const fireAlert = () => {
      if (!hasInteracted.current || alertShown.current) return;
      alertShown.current = true;

      Swal.fire({
        title: "เฮ้ ไปไหนมา? 👀",
        text: "ออกไปนอกหน้านี้ทั้งๆ ที่ยังพิมพ์ไม่เสร็จ",
        icon: "warning",
        confirmButtonText: "กลับมาแล้ว",
        confirmButtonColor: "#534AB7",
        showCancelButton: true,
        cancelButtonText: "ไปก่อนนะ",
        // ไม่ใส่ timer ใน Swal เพราะเราจัดการเองด้วย focus event
      }).then(() => {
        alertShown.current = false;
        clearTimeout(swalTimer.current);
      });
    };

    const closeAlert = () => {
      if (!alertShown.current) return;
      // หน่วง 3 วิแล้วปิด
      swalTimer.current = setTimeout(() => {
        Swal.close();
        alertShown.current = false;
      }, 3000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(swalTimer.current); // ยกเลิก timer เก่าถ้ามี
        fireAlert();
      } else {
        closeAlert(); // กลับมา visible → เริ่มนับ 3 วิ
      }
    };

    const handleBlur = () => {
      if (!document.hidden) {
        clearTimeout(swalTimer.current);
        fireAlert();
      }
    };

    const handleFocus = () => {
      closeAlert(); // focus กลับมา → เริ่มนับ 3 วิ
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus); // จับตอนกลับมา

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      clearTimeout(swalTimer.current);
    };
  }, []);

  return (
    <div>
      <textarea placeholder="คลิกที่นี่แล้วลองเปลี่ยน tab..." rows={4} />
    </div>
  );
}
